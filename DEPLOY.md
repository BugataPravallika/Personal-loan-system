Deployment guide for EzFinanz (Render backend + Vercel frontend)

Overview
--------
This guide explains how to deploy the EzFinanz demo to Render (backend) and Vercel (frontend) from the feature/deploy-render-vercel branch.

Important: In production set EZFINANZ_DEV_MODE=false and configure SMTP/Twilio credentials and a persistent Postgres database.

Backend (Render)
-----------------
1. Create a new Web Service on Render and connect your GitHub repo (BugataPravallika/Personal-loan-system).
2. Select the branch: feature/deploy-render-vercel
3. Build command:
   pip install -r backend/requirements.txt
4. Start command (Render sets $PORT automatically):
   backend\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
   (Note: If you prefer use python from system env, use: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT)
5. Environment variables (minimum):
   - EZFINANZ_DEV_MODE=false
   - SECRET_KEY=<secure random string>
   - DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db>
   - VITE_API_URL=https://<your-render-backend>
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD (if using SMTP email)
   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (if using Twilio SMS)
   - GOOGLE_CLIENT_ID (for Google OAuth)
6. Database: Use Render Postgres for production. Run migrations (replace demo ALTERs with Alembic in production).
7. Important: do NOT keep EZFINANZ_DEV_MODE=true in production.

Frontend (Vercel)
------------------
1. Create a new Vercel project and import the same GitHub repo.
2. For monorepo, set Root Directory to frontend (or configure a custom build):
   - Framework preset: Other (or Vite)
   - Build command: npm run build
   - Output directory: frontend/dist  (or as configured by your vite build)
3. Environment variables in Vercel:
   - VITE_API_URL=https://<your-render-backend>
   - VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
4. Add the Vercel domain to Authorized JavaScript origins in Google Cloud Console for Google OAuth.

Google OAuth
------------
- In Google Cloud Console, set Authorized JavaScript origins to:
  - http://localhost:3000 (for local dev)
  - https://<your-vercel-domain>
- Configure OAuth consent screen and enable the Identity APIs as required.

Dev mode & testing
------------------
- For demo/testing set EZFINANZ_DEV_MODE=true on the Render service to enable the in-app OTP inbox. Do NOT use this for production.
- To test Google OAuth locally, add http://localhost:3000 as an authorized origin and set VITE_GOOGLE_CLIENT_ID in frontend .env or Vercel env.

Render / Vercel checklist
-------------------------
- [ ] Ensure branch feature/deploy-render-vercel is available in GitHub
- [ ] Configure Render service with environment variables and Postgres
- [ ] Configure Vercel project and set VITE_API_URL
- [ ] Update Google Cloud Console OAuth settings

Troubleshooting notes
---------------------
- SQLite concurrency: this app used SQLite for local demo. Use Postgres in production to avoid write contention.
- Twilio trial accounts may not deliver to unverified numbers — configure Twilio properly before production.
- When EZFINANZ_DEV_MODE=false, OTPs will not be visible in /api/verification/inbox; ensure SMS/Email providers are configured.

