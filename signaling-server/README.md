# Nose Roast 1v1 signaling Server 🚀

This is the dedicated, high-performance WebRTC signaling server for **Nose Roast**. Running this on your Railway account guarantees 100% reliable, real-time multiplayer duels without being rate-limited by PeerJS's public cloud when your game goes viral or is played by streamers!

---

## 🛠️ Step-by-Step Railway Deployment Guide

Since you already have a active Railway account, you can deploy this in 3 minutes:

### Step 1: Push to GitHub
We recommend creating a small standalone GitHub repository for this signaling server, or pushing it as part of your main project repo:

1. Open your terminal, navigate here, and initialize a new git repo (if it's not already in one):
   ```bash
   cd signaling-server
   git init
   git add .
   git commit -m "feat: init nose roast signaling server for railway"
   ```
2. Create a new repository on your GitHub account named `noseroast-signaling`.
3. Link and push the code:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/noseroast-signaling.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Railway
1. Go to your [Railway Dashboard](https://railway.app/).
2. Click **+ New Project** -> **Deploy from GitHub repo**.
3. Select your `noseroast-signaling` repository.
4. Click **Deploy Now**.
5. Once built, go to your new service's **Settings** tab in Railway:
   - Under **Networking**, click **Generate Domain** to get your public SSL URL (e.g., `noseroast-signaling-production.up.railway.app`).
   - Railway will automatically bind the deployment to the dynamic `PORT` environment variable.

---

## 🔗 Hooking It Up in Nose Roast Frontend

Once your Railway domain is live, you can switch the game to use your new private signaling cloud:

1. Open [App.tsx](file:///d:/Nose%20Roast/App.tsx) in your editor.
2. Near the top of the file, find the custom signaling configuration block:
   ```typescript
   // WebRTC custom signaling server configuration (deployed to Railway)
   // Toggle to true to use your own secure Railway server to bypass public rate limits.
   const USE_CUSTOM_SIGNALING = true; // 👈 Set this to true!
   const SIGNALING_HOST = 'your-signaling-app.up.railway.app'; // 👈 Replace with your Railway generated domain!
   const SIGNALING_PORT = 443; // Keep as 443 for secure SSL
   const SIGNALING_PATH = '/noseroast';
   ```
3. Save the file and rebuild/redeploy your frontend! 

---

## 💡 How P2P Scaling Works
* **Infinite Scale / Zero Cost:** Video streams, game canvas rendering, and real-time nose scores flow **directly browser-to-browser (P2P)** via WebRTC.
* **Low Bandwidth:** This signaling server is *only* used for the initial 3-second handshake (matching player IDs). Once connected, the server is no longer involved. This means you can easily support thousands of concurrent duels on Railway's entry-tier resources ($5/month plan).
* **Robust Configuration:** The server uses `proxied: true` inside `server.js` to ensure secure WebSockets (`wss://`) negotiate correctly behind Railway's load balancer and SSL wrappers.
