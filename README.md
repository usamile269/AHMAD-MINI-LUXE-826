# 🚀 AHMAD MINI BOT - Ready to Run

This is a fully configured WhatsApp Bot base, optimized for **Railway**, **Render**, and other cloud hosting platforms.

## 🛠️ Setup & Deployment

### 1. Railway Deployment (Recommended)
1. Fork or Upload this repository to your GitHub.
2. Go to [Railway.app](https://railway.app/) and create a new project.
3. Connect your GitHub repository.
4. Go to the **Variables** tab and add the following:
   - `MONGODB_URI`: Your MongoDB connection string (Required for persistent data).
   - `SESSION_ID`: Your unique session identifier.
   - `OWNER_NUMBER`: Your WhatsApp number (e.g., `923044975027`).
   - `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/BotFather) for pairing.
   - `RAPID_API_KEY`: Get from [RapidAPI](https://rapidapi.com/) for downloaders.
5. Deploy! Railway will automatically detect `package.json` and start the bot.

### 2. Heroku Deployment
1. Push this repo to your own GitHub.
2. On Heroku, create a new app → **Deploy** tab → connect that GitHub repo.
3. `app.json` at the repo root pre-fills the required config vars (`SESSION_ID`, `MONGODB_URI`, `OWNER_NUMBER`, etc.) — fill them in when prompted, or set them under **Settings → Config Vars** after deploy.
4. Heroku uses the included `Procfile` (`web: node index.js`) to start the bot automatically.
5. Free/eco dynos sleep and have a 512MB memory cap — the bot already self-restarts under `RSS_LIMIT_MB` (default 400MB) before Heroku force-kills it, so keep that setting as-is unless you're on a bigger dyno.

### 3. Local Setup
1. Install [Node.js](https://nodejs.org/) (v18 or higher).
2. Clone the repository and open a terminal in the folder.
3. Run `npm install` to install dependencies.
4. Rename `.env.example` to `.env` and fill in your credentials.
5. Run `npm start` to launch the bot.

## 📂 Features
- **Pairing via Telegram**: Connect your WhatsApp without scanning a QR code.
- **MongoDB Support**: Your settings and paired numbers survive redeploys.
- **Auto Status View/Like**: Automatically interact with your contacts' statuses.
- **Advanced Downloaders**: Support for TikTok, Instagram, YouTube, and more.
- **Admin Panel**: Hidden web panel for quick configuration.

## ⚠️ Security Warning
- Never share your `SESSION_ID` or `MONGODB_URI`.
- Rotate your `RAPID_API_KEY` and `TELEGRAM_BOT_TOKEN` if they are exposed.

---
**© Powered by AHMAD**
