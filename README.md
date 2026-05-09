# ALMEER – M-Pesa STK Push Payment Site

A fully working M-Pesa Lipa na M-Pesa (STK Push) payment site.
**Receives payments to: +254720313769 · Account: ALMEER**

---

## 🚀 Quick Start (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then edit `.env` with your Daraja credentials (see below).

### 3. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 4. Open the site
```
http://localhost:3000
```

---

## 🔑 Getting Your Daraja Credentials

### Step 1 — Create a Safaricom Developer Account
1. Go to **https://developer.safaricom.co.ke**
2. Sign up / log in
3. Click **"My Apps"** → **"Create New App"**
4. Enable **M-Pesa Express (Lipa na M-Pesa)** for your app
5. Copy your **Consumer Key** and **Consumer Secret**

### Step 2 — Get Your Shortcode & Passkey
- **Sandbox shortcode**: `174379`
- **Sandbox passkey**: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
- For **production**, use the shortcode assigned to your till/paybill and the passkey from the Daraja portal

### Step 3 — Fill in your .env
```env
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=paste_your_key_here
MPESA_CONSUMER_SECRET=paste_your_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_RECEIVER=254720313769
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
PORT=3000
```

---

## 🌍 Exposing Your Callback URL (for local testing)

Safaricom needs to reach your server to confirm payments. Use **ngrok**:

```bash
# Install ngrok
npm install -g ngrok

# In a separate terminal, expose port 3000
npx ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`) and set:
```env
MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/mpesa/callback
```

---

## 🏭 Going Live (Production)

1. Change `MPESA_ENV=production` in `.env`
2. Use your **production shortcode** and **passkey** from Safaricom
3. Set `MPESA_CALLBACK_URL` to your real domain over HTTPS
4. Deploy to a server (Railway, Render, DigitalOcean, Heroku, etc.)

### Deploy to Railway (easiest)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Deploy to Render
1. Push code to GitHub
2. Create a new **Web Service** on render.com
3. Set environment variables in the Render dashboard
4. Deploy!

---

## 📁 Project Structure

```
almeer-mpesa/
├── server.js          # Express backend (STK Push API)
├── package.json       # Dependencies
├── .env.example       # Environment template
├── .env               # Your credentials (DO NOT commit!)
└── public/
    └── index.html     # Frontend payment page
```

---

## 🔒 Security Notes

- **Never commit `.env`** to git — add it to `.gitignore`
- **Never expose** Consumer Key/Secret in frontend code
- In production, add **rate limiting** (e.g. `express-rate-limit`)
- Consider storing transactions in a **real database** (PostgreSQL, MongoDB)

---

## 📞 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stk-push` | Initiate STK Push |
| GET | `/api/status/:id` | Poll transaction status |
| POST | `/api/mpesa/callback` | Safaricom result callback |

---

## 💡 Test on Sandbox

Use these test credentials on sandbox:
- **Phone**: `254708374149` (Safaricom test number)
- **PIN**: `1234`
- **Amount**: Any amount ≥ 1

---

Built for ALMEER · Powered by Safaricom Daraja API
