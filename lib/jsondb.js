// ============================================================================
// lib/jsondb.js — tiny local JSON-file "database"
// ----------------------------------------------------------------------------
// Replaces MongoDB/Mongoose completely. No internet, no external service, no
// connection string needed — every "collection" is just a .json file inside
// the /database folder on disk. The API on purpose mimics the small subset of
// Mongoose methods this project actually used (findOne, find, create,
// findOneAndUpdate, deleteOne, deleteMany, countDocuments) so every file that
// used to talk to Mongoose keeps working with only a 2-line change at the top
// (require this instead of mongoose, call jsondb.model('Name') instead of
// mongoose.model('Name', schema)).
//
// IMPORTANT for hosting: the /database folder must be on a PERSISTENT disk.
// On Railway/Render this means attaching a persistent volume; on plain VPS/
// Panel hosting the local folder already persists between restarts on its
// own. Free tiers that wipe the filesystem on every redeploy will lose data
// stored here (same limitation MongoDB free-tier didn't have) — see the
// README section on hosting for details.
// ============================================================================

const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.JSONDB_DIR || path.join(__dirname, '..', 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function withHelpers(doc) {
    if (!doc) return doc;
    return { ...doc, toObject: () => ({ ...doc }) };
}

class Collection {
    constructor(name) {
        this.name = name;
        this.file = path.join(DB_DIR, `${name}.json`);
        this.docs = [];
        this._load();
        this._saveTimer = null;
    }

    _load() {
        try {
            if (fs.existsSync(this.file)) {
                this.docs = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            }
        } catch (e) {
            console.error(`⚠️ jsondb: failed to read ${this.name}.json, starting empty:`, e.message);
            this.docs = [];
        }
    }

    // Debounced write so bursts of updates (e.g. stats incrementing on every
    // message) don't hammer the disk with a write per call.
    _save() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            try {
                fs.writeFileSync(this.file, JSON.stringify(this.docs, null, 2));
            } catch (e) {
                console.error(`⚠️ jsondb: failed to write ${this.name}.json:`, e.message);
            }
        }, 120);
    }

    _match(doc, query) {
        return Object.keys(query).every((k) => {
            const q = query[k];
            if (q && typeof q === 'object' && !Array.isArray(q)) {
                if ('$gt' in q) return new Date(doc[k]) > new Date(q.$gt);
                if ('$gte' in q) return new Date(doc[k]) >= new Date(q.$gte);
                if ('$ne' in q) return doc[k] !== q.$ne;
                // 🆕 (needed for .cleardb — wiping every record whose key
                // starts with "botNumber::") $regex, Mongo-query-style.
                if ('$regex' in q) {
                    const flags = q.$options || '';
                    return new RegExp(q.$regex, flags).test(String(doc[k] ?? ''));
                }
                return false;
            }
            return doc[k] === q;
        });
    }

    _applyUpdate(doc, update) {
        const $inc = update.$inc;
        const $set = update.$set;
        const $unset = update.$unset;
        const plain = { ...update };
        delete plain.$inc;
        delete plain.$set;
        delete plain.$unset;

        let merged = { ...doc, ...plain, ...($set || {}) };
        if ($inc) for (const k in $inc) merged[k] = (merged[k] || 0) + $inc[k];
        if ($unset) for (const k in $unset) delete merged[k];
        merged.updatedAt = new Date().toISOString();
        return merged;
    }

    async findOne(query = {}) {
        const found = this.docs.find((d) => this._match(d, query));
        return withHelpers(found);
    }

    async find(query = {}) {
        return this.docs.filter((d) => this._match(d, query)).map(withHelpers);
    }

    async create(data) {
        const doc = { _id: genId(), createdAt: new Date().toISOString(), ...data };
        this.docs.push(doc);
        this._save();
        return withHelpers(doc);
    }

    async findOneAndUpdate(query, update = {}, opts = {}) {
        const idx = this.docs.findIndex((d) => this._match(d, query));

        if (idx === -1) {
            if (!opts.upsert) return null;
            const base = { _id: genId(), ...query };
            const doc = this._applyUpdate(base, update);
            this.docs.push(doc);
            this._save();
            return withHelpers(doc);
        }

        const merged = this._applyUpdate(this.docs[idx], update);
        this.docs[idx] = merged;
        this._save();
        return withHelpers(merged);
    }

    async updateMany(query = {}, update = {}) {
        let modifiedCount = 0;
        this.docs = this.docs.map((d) => {
            if (this._match(d, query)) {
                modifiedCount++;
                return this._applyUpdate(d, update);
            }
            return d;
        });
        if (modifiedCount) this._save();
        return { modifiedCount };
    }

    async deleteOne(query = {}) {
        const idx = this.docs.findIndex((d) => this._match(d, query));
        if (idx !== -1) {
            this.docs.splice(idx, 1);
            this._save();
        }
        return { deletedCount: idx !== -1 ? 1 : 0 };
    }

    async deleteMany(query = {}) {
        const before = this.docs.length;
        this.docs = this.docs.filter((d) => !this._match(d, query));
        this._save();
        return { deletedCount: before - this.docs.length };
    }

    async countDocuments(query = {}) {
        return this.docs.filter((d) => this._match(d, query)).length;
    }
}

const collections = {};
function model(name) {
    if (!collections[name]) collections[name] = new Collection(name);
    return collections[name];
}

module.exports = { model };
