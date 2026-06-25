# Deploying San Tan Family Pulse to Render (Free Tier)

## What You'll Get
- ✅ Public website running 24/7
- ✅ Automatic newsletter generation every Thursday
- ✅ Database to store all editions
- ✅ Admin dashboard to review & publish
- ✅ PDF export & email copy functionality
- ✅ $0/month cost (Render free tier)

## Prerequisites
1. GitHub account (free)
2. Render account (free at render.com)
3. Anthropic API key (for Claude)

## Step 1: Prepare Your Code for GitHub

1. Create a GitHub repository for this project
2. Upload all files:
   - `server-cloud.js`
   - `package.json`
   - `public/` folder
   - `.env.example`
   - `README.md`
   - `render.yaml` (create below)

3. **DO NOT commit your `.env` file or API key** — only commit `.env.example`

## Step 2: Create render.yaml

In your repo root, create a file called `render.yaml`:

```yaml
services:
  - type: web
    name: san-tan-family-pulse
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: ANTHROPIC_API_KEY
        scope: build
        sync: false
    disk:
      name: data
      mountPath: /var/data
      sizeGB: 1
```

## Step 3: Deploy on Render

1. Go to **render.com** and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Choose **"Deploy an existing repository"**
4. Connect your GitHub account
5. Select your San Tan Family Pulse repo
6. Click **"Create Web Service"**
7. Render will ask for environment variables:
   - **ANTHROPIC_API_KEY**: Paste your API key here
8. Click **"Deploy"**

Render will:
- Build your app (installs npm packages)
- Start the server
- Assign you a free URL like `san-tan-family-pulse.onrender.com`

## Step 4: Access Your Newsletter

**Public website**: `https://yourapp.onrender.com`
- Shows latest edition
- Archive of all past editions
- PDF download & email copy buttons

**Admin dashboard**: `https://yourapp.onrender.com/admin`
- Generate new drafts
- Review before publishing
- Publish to public site

## Step 5: Automatic Thursday Generation

The scheduler in `server-cloud.js` will generate drafts every Thursday at 8 AM UTC automatically.

To change the time, edit this line in `server-cloud.js`:
```javascript
cron.schedule('0 8 * * 4', async () => {
  // 0 8 = 8 AM, * * 4 = every Thursday
  // Change to '0 18 * * 4' for 6 PM, etc.
```

Then redeploy.

## Step 6: Email Integration (Optional)

To automatically email to Beehiiv subscribers:

1. Get your Beehiiv API key
2. Add a function to `server-cloud.js`:
```javascript
async function emailNewsletter(editionId) {
  const res = await fetch('https://api.beehiiv.com/v2/publications/.../emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject: `San Tan Family Pulse - Weekly Edition`,
      // ... email content
    })
  });
}
```
3. Add `BEEHIIV_API_KEY` to Render environment variables
4. Call this function when publishing an edition

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Render (free tier) | $0 |
| Claude Haiku API (~52 newsletters/year) | $5-8/month |
| Domain name (optional) | $10-15/year |
| **Total** | **~$5-10/month** |

## Troubleshooting

**Scheduled generation isn't running:**
- Render free tier has memory constraints. If it's failing, check logs in Render dashboard.
- Solution: Upgrade to Render's $7/month "Starter" plan for guaranteed scheduled job support.

**Database not persisting:**
- Render free tier resets disk periodically. For production, upgrade to paid plan OR use a free PostgreSQL service (Supabase).

**API rate limit errors:**
- You're hitting Claude's rate limits. Solution: Add $5 to Anthropic account to upgrade tier, or wait 60 seconds between generations.

## For Production / Paid Subscription

If you launch this as a paid product:

1. **Add authentication** to admin dashboard (protect `/admin` page)
2. **Use a production database** (Supabase PostgreSQL instead of SQLite)
3. **Upgrade Render plan** to ensure 24/7 uptime
4. **Use a custom domain** (buy from Namecheap, point to Render)
5. **Add email integration** so subscribers get weekly emails automatically
6. **Add payment processing** (Stripe) for subscription management

For now, this free setup is perfect for testing and MVP.

---

**Questions?** Render has great docs at render.com/docs — highly recommended.
