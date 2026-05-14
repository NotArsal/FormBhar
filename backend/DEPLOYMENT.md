# FormBhar Analytics Backend Deployment Guide

To track live users and form completions for the FormBhar extension globally, you need to deploy the Node.js backend to a public server (like Render, Vercel, or Heroku) and connect it to a managed PostgreSQL database.

## 1. Database Setup (Supabase / Render PostgreSQL)
1. Create a free PostgreSQL database on [Supabase](https://supabase.com/).
2. Get the connection string (URI) from the project settings (e.g., `postgresql://postgres:password@db.supabase.co:5432/postgres`).
3. Connect to the database using an SQL client (like pgAdmin, DBeaver, or Supabase's SQL editor) and run the table creation script found in `backend/schema.sql`.

## 2. Deploying the Backend (Render - Recommended for Node.js/PostgreSQL)
1. Push your `backend` folder to a new GitHub repository.
2. Sign up at [Render](https://render.com/) and create a new **Web Service**.
3. Connect your GitHub repository.
4. Set the following details:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Click on **Advanced** -> **Add Environment Variables**:
   - `DATABASE_URL`: Your PostgreSQL connection string (from Step 1).
6. Click **Create Web Service**. Render will deploy the application and give you a public URL (e.g., `https://formbhar-backend-7ir1.onrender.com`).

## 3. Extension Configuration Update
Once the backend is deployed:
1. Open `extension/background/analytics.js` and `extension/popup/popup.js`.
2. Change the `API_BASE` or `fetch` URL to your new deployed URL: `https://formbhar-backend-7ir1.onrender.com/api...`.
3. Update `extension/manifest.json` host permissions to include your new domain `https://formbhar-backend-7ir1.onrender.com/*`.
4. Pack the extension and publish it!

---

## 4. Testing Multi-Session Architecture (Postman)
Before finalizing, verify the true multi-session support:
1. **Register User**: `POST /api/register-user`
   ```json
   { "userId": "11111111-1111-1111-1111-111111111111", "extensionVersion": "2.0.0" }
   ```
2. **Start Session**: `POST /api/start-session`
   ```json
   { "userId": "11111111-1111-1111-1111-111111111111" }
   ```
   *(Copy the `sessionId` from the response)*
3. **Ping**: `POST /api/ping`
   ```json
   { "sessionId": "YOUR_SESSION_ID_HERE" }
   ```
4. **Stats Verification**: `GET /api/stats`
   - Should result in `liveUsers: 1`.
   - Wait 70 seconds. Run again. It should drop to `liveUsers: 0` because the session is no longer active within the 60-second window.
