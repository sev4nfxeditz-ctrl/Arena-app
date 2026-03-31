# ============================================
# Arena Pro — Deployment Configuration
# ============================================

## 📋 Prerequisites

1. **Neon PostgreSQL** — sign up at [neon.tech](https://neon.tech) (free tier)
2. **Upstash Redis** — sign up at [upstash.com](https://upstash.com) (free tier)
3. **Vercel** — for frontend deployment
4. **Railway** — for backend deployment
5. **Google Cloud Console** — for OAuth (optional)
6. **GitHub Developer Settings** — for GitHub OAuth (optional)

---

## 🗄️ Step 1: Database Setup (Neon)

1. Create a Neon project
2. Copy the connection string
3. Run the migration:

```bash
# Set DATABASE_URL and run
cd server
DATABASE_URL="postgres://..." npm run migrate
```

---

## 🔴 Step 2: Redis Setup (Upstash)

1. Create a Redis database on Upstash
2. Copy the Redis URL (format: `redis://default:xxx@xxx.upstash.io:6379`)

---

## 🖥️ Step 3: Backend Deployment (Railway)

1. Connect your GitHub repo to Railway
2. Set the root directory to `server`
3. Set environment variables:
   - `DATABASE_URL` — from Neon
   - `REDIS_URL` — from Upstash
   - `JWT_SECRET` — generate a random 64-character string
   - `CORS_ORIGIN` — your Vercel frontend URL
   - `NODE_ENV` — `production`
   - `PORT` — Railway sets this automatically
4. Start command: `npm run build && npm start`

---

## 🌐 Step 4: Frontend Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set the root directory to `frontend`
3. Framework Preset: Next.js
4. Set environment variables:
   - `NEXT_PUBLIC_API_URL` — your Railway backend URL (e.g., `https://arena-server.up.railway.app`)
   - `NEXT_PUBLIC_WS_URL` — same as API URL (Socket.IO uses same port)
   - `NEXTAUTH_SECRET` — generate a random string
   - `NEXTAUTH_URL` — your Vercel URL

---

## 🔑 Step 5: OAuth Setup (Optional)

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Set authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to both Railway and Vercel

### GitHub OAuth
1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new app
3. Set callback URL: `https://your-app.vercel.app/api/auth/callback/github`
4. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to both Railway and Vercel

---

## ✅ Step 6: Verify

```bash
# Test backend health
curl https://your-backend.railway.app/health

# Test frontend
open https://your-app.vercel.app
```

---

## 🔧 WebSocket Configuration

Railway natively supports WebSockets — no additional configuration needed.

For custom domains, ensure your DNS/proxy supports WebSocket upgrades.
Socket.IO fallback to long-polling is enabled automatically.

---

## 📊 Monitoring

- **Railway** provides logs and metrics
- **Vercel** provides analytics and error tracking
- **Upstash** shows Redis usage statistics
- **Neon** shows database metrics
