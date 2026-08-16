// ============================================================================
// lib/mongo.js — universal persistent storage picker
// ----------------------------------------------------------------------------
// 🚨 FIX (requested by Ahmad — paired numbers/settings vanishing every time
// he re-uploads a new ZIP): every collection used to go straight to
// lib/jsondb.js (a local /database/*.json file). That's fine on hosts with
// a real persistent disk, but on Railway a fresh deploy = a fresh
// container = an empty filesystem, so every paired session and every
// setting (antidelete, antilink, group rules, etc.) was wiped on every
// redeploy.
//
// This file exposes ONE `model(name)` function with the exact same API as
// jsondb's (findOne, find, create, findOneAndUpdate, updateMany, deleteOne,
// deleteMany, countDocuments):
//   - If config.MONGODB_URI is set, every collection is actually a MongoDB
//     Atlas collection — survives redeploys, container restarts, anything.
//   - If it's empty/unset, this transparently falls back to the existing
//     local-JSON jsondb behavior — nothing breaks for anyone who hasn't
//     set up Mongo yet, it just keeps the old (wipe-on-redeploy) behavior.
// ============================================================================

const jsondb = require('./jsondb');
const config = require('../config');

let client = null;
let db = null;
let connecting = null;
const MONGO_URI = (config.MONGODB_URI || '').trim();

async function ensureConnected() {
    if (!MONGO_URI) return null;
    if (db) return db;
    if (connecting) return connecting;

    connecting = (async () => {
        try {
            const { MongoClient } = require('mongodb');
            client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
            await client.connect();
            db = client.db(); // uses the db name from the URI, or 'test' if none given
            console.log('✅ MongoDB connected — sessions & settings will now survive redeploys.');
            return db;
        } catch (e) {
            console.error('❌ MongoDB connection failed, falling back to local JSON storage:', e.message);
            db = null;
            return null;
        }
    })();

    return connecting;
}

function withHelpers(doc) {
    if (!doc) return doc;
    return { ...doc, toObject: () => ({ ...doc }) };
}

// Mirrors jsondb's update semantics: plain fields merge in like $set, but
// explicit $inc/$set/$unset from callers (e.g. data/Warnings.js) still work.
function buildMongoUpdate(update = {}) {
    const $inc = update.$inc;
    const $unset = update.$unset;
    const plain = { ...update };
    delete plain.$inc;
    delete plain.$set;
    delete plain.$unset;
    const $set = { ...plain, ...(update.$set || {}), updatedAt: new Date().toISOString() };

    const mongoUpdate = { $set };
    if ($inc) mongoUpdate.$inc = $inc;
    if ($unset) mongoUpdate.$unset = $unset;
    return mongoUpdate;
}

class MongoCollection {
    constructor(name) {
        this.name = name;
        // 🚨 BUG FIX (Bunty: ".setwelcome/.gwelcomevideo set karta hai,
        // '✅ saved' bhi bolta hai, but welcome par kuch aata hi nahi"):
        // if MONGO_URI is configured but the actual connection/write fails
        // at runtime (network blip, Atlas hiccup, IP allowlist issue,
        // etc.), _col() used to just throw "Mongo not connected" forever
        // for every operation on this collection — with NO fallback,
        // despite this file's own comment claiming one. Every setting
        // command silently failed to save while still showing a fake "✅"
        // success message. Now falls back to local JSON storage
        // per-operation whenever Mongo genuinely can't be reached, so a
        // save always actually lands SOMEWHERE instead of vanishing.
        this._jsondbFallback = null;
    }

    _fallback() {
        if (!this._jsondbFallback) this._jsondbFallback = jsondb.model(this.name);
        return this._jsondbFallback;
    }

    async _col() {
        const database = await ensureConnected();
        if (!database) return null; // signal to callers: use the local fallback instead
        return database.collection(this.name);
    }

    async findOne(query = {}) {
        const col = await this._col();
        if (!col) return this._fallback().findOne(query);
        const doc = await col.findOne(query);
        return withHelpers(doc);
    }

    async find(query = {}) {
        const col = await this._col();
        if (!col) return this._fallback().find(query);
        const docs = await col.find(query).toArray();
        return docs.map(withHelpers);
    }

    async create(data) {
        const col = await this._col();
        if (!col) return this._fallback().create(data);
        const doc = { createdAt: new Date().toISOString(), ...data };
        const res = await col.insertOne(doc);
        return withHelpers({ ...doc, _id: res.insertedId });
    }

    async findOneAndUpdate(query, update = {}, opts = {}) {
        const col = await this._col();
        if (!col) return this._fallback().findOneAndUpdate(query, update, opts);
        const mongoUpdate = buildMongoUpdate(update);
        const res = await col.findOneAndUpdate(query, mongoUpdate, {
            upsert: !!opts.upsert,
            returnDocument: 'after'
        });
        // Driver version differences: some return the doc directly, some wrap it in { value }.
        const doc = (res && res.value !== undefined) ? res.value : res;
        return withHelpers(doc || null);
    }

    async updateMany(query = {}, update = {}) {
        const col = await this._col();
        if (!col) return this._fallback().updateMany(query, update);
        const mongoUpdate = buildMongoUpdate(update);
        const res = await col.updateMany(query, mongoUpdate);
        return { modifiedCount: res.modifiedCount || 0 };
    }

    async deleteOne(query = {}) {
        const col = await this._col();
        if (!col) return this._fallback().deleteOne(query);
        const res = await col.deleteOne(query);
        return { deletedCount: res.deletedCount || 0 };
    }

    async deleteMany(query = {}) {
        const col = await this._col();
        if (!col) return this._fallback().deleteMany(query);
        const res = await col.deleteMany(query);
        return { deletedCount: res.deletedCount || 0 };
    }

    async countDocuments(query = {}) {
        const col = await this._col();
        if (!col) return this._fallback().countDocuments(query);
        return col.countDocuments(query);
    }
}

const collections = {};
function model(name) {
    if (collections[name]) return collections[name];
    // Pick the backend ONCE per collection name: Mongo if a URI is
    // configured, otherwise the existing local-JSON jsondb model — same
    // call sites, same method names, zero changes needed anywhere else.
    collections[name] = MONGO_URI ? new MongoCollection(name) : jsondb.model(name);
    return collections[name];
}

module.exports = { model, isMongoConfigured: !!MONGO_URI, ensureConnected };
