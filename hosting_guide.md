# Hosting and Deployment Guide for Trixon

This guide explains how to properly configure your frontend (Vercel) and backend (Render) hosting environments to avoid `404` routing issues, redirect mismatches, and connection errors when linking GitHub.

---

## 1. Frontend Configuration (Vercel)

The frontend is hosted at `https://trixon-saas.vercel.app`.

### Required Vercel Dashboard Environment Variables
Do not define environment variables inside `vercel.json` as Vercel no longer supports the deprecated `@secrets` syntax. Instead, configure them directly in your **Vercel Project Dashboard** (Settings → Environment Variables):

| Variable Name | Value / Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Public Key |
| `NEXT_PUBLIC_BACKEND_URL` | `https://trixon-backend.onrender.com` (Your Render backend URL) |
| `NEXT_PUBLIC_API_URL` | `https://trixon-backend.onrender.com` (Keep as fallback) |
| `NEXT_PUBLIC_APP_URL` | `https://trixon-saas.vercel.app` (Your production frontend URL) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | `Ov23liEw1tgNgx0ENnA4` |
| `NEXT_PUBLIC_BETA_MODE` | `true` |

> [!IMPORTANT]  
> After adding or updating these variables in the Vercel Dashboard, you **must trigger a new deployment/rebuild** in Vercel for the client-side files to embed the new values. Otherwise, they will build with old or empty values, resulting in `404` errors on API requests.

---

## 2. Backend Configuration (Render)

The backend is hosted at `https://trixon-backend.onrender.com`.

### Required Render Dashboard Environment Variables
Configure the following in your **Render Service Dashboard** (Environment tab):

| Variable Name | Value / Description |
|---|---|
| `PYTHON_VERSION` | `3.12` |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key (bypasses RLS for public summary badges) |
| `CORS_ALLOWED_ORIGINS` | `https://trixon-saas.vercel.app` (Allows your Vercel frontend to fetch backend APIs without CORS errors) |
| `GITHUB_CLIENT_ID` | `Ov23liEw1tgNgx0ENnA4` |
| `GITHUB_CLIENT_SECRET` | *(Your GitHub App Client Secret)* |
| `GITHUB_WEBHOOK_SECRET` | *(Your GitHub App Webhook Signature Verification Secret)* |
| `GITLAB_CLIENT_ID` | *(Optional)* |
| `GITLAB_CLIENT_SECRET` | *(Optional)* |
| `GITLAB_WEBHOOK_SECRET` | *(Optional)* |
| `ENCRYPTION_KEY` | AES-256 encryption key (used to encrypt connected VCS tokens in database) |
| `ADMIN_SECRET` | Secret key protecting admin routes |
| `BETA_MODE` | `true` |

---

## 3. GitHub OAuth Application Configuration

Ensure your OAuth App settings on GitHub exactly match your live URLs:

1. Go to **GitHub** → **Settings** → **Developer Settings** → **OAuth Apps**.
2. Select your application (`Ov23liEw1tgNgx0ENnA4`).
3. Update the following fields:
   - **Homepage URL**: `https://trixon-saas.vercel.app`
   - **Authorization callback URL**: `https://trixon-saas.vercel.app/auth/callback/github`
