# San Tan Family Pulse — Cloud Version

A fully autonomous AI-powered newsletter generator for East Valley Arizona families. Generates, stores, and publishes weekly community newsletters about local events, restaurants, and activities.

## Architecture

```
┌─────────────────────────────────────────┐
│  Render Web Service (Free Tier)         │
├─────────────────────────────────────────┤
│  ✓ Node.js Server (server-cloud.js)     │
│  ✓ SQLite Database (newsletters.db)     │
│  ✓ Scheduler (runs Thursday @ 8 AM UTC) │
│  ✓ Public Website (/public)             │
│  ✓ Admin Dashboard (/admin)             │
└─────────────────────────────────────────┘
         ↓ uses Claude API
┌─────────────────────────────────────────┐
│  Anthropic Claude Haiku                 │
│  - Web search for local content         │
│  - Write newsletter in Scoop style      │
│  - ~$0.10 per newsletter                │
└─────────────────────────────────────────┘
```

## Features

### Public Website
- **Latest Edition** — Shows the most recent published newsletter
- **Archive** — Browse all past editions by city and date
- **PDF Export** — Download editions as formatted PDFs
- **Email Copy** — Copy text for pasting into Beehiiv or email

### Admin Dashboard
- **Generate Drafts** — Create newsletters for any city on-demand
- **Preview** — Review content before publishing
- **Publish** — Approve drafts to make them public
- **Manual + Automatic** — Scheduled Thursday generation + manual overrides

### Backend API
```
GET  /api/latest                    — Get latest published edition
GET  /api/editions                  — Get all published editions
GET  /api/editions/:id              — Get specific edition
GET  /api/editions/:id/pdf          — Download as PDF
POST /api/generate                  — Generate new draft
POST /api/editions/:id/publish      — Publish draft
```

## Local Development

### Setup

1. **Clone the repo** (or download files):
```bash
git clone https://github.com/yourusername/san-tan-family-pulse
cd san-tan-family-pulse
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create `.env` file**:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
```

4. **Run locally**:
```bash
npm start
```

5. **Open browser**:
- Website: http://localhost:3000
- Admin: http://localhost:3000/admin

### Development Tips

- **Scheduler won't run** in dev mode (only on cloud). Use `/api/generate` manually to test.
- **Database**: SQLite file stored in `newsletters.db` (created automatically)
- **Logs**: Check terminal output to see generation progress

## Cloud Deployment (Render)

See **DEPLOY_TO_RENDER.md** for step-by-step instructions.

**Summary:**
1. Push code to GitHub
2. Connect GitHub to Render
3. Set `ANTHROPIC_API_KEY` environment variable
4. Deploy — Render builds and runs your app
5. Get a public URL like `san-tan-family-pulse.onrender.com`
6. Every Thursday at 8 AM UTC, a new draft is generated automatically

## File Structure

```
.
├── server-cloud.js              # Main backend server + API + scheduler
├── package.json                 # Dependencies
├── render.yaml                  # Render deployment config
├── public/
│   ├── index.html               # Public website (latest + archive)
│   └── admin.html               # Admin dashboard
├── newsletters.db               # SQLite database (auto-created)
├── .env                         # API keys (local only, never commit)
└── README_CLOUD.md             # This file
```

## How It Works

### Weekly Generation (Automatic Every Thursday)

1. **8 AM UTC** — Cron scheduler triggers
2. **Research** — Claude searches web for family content in each city
   - Macaroni KID event calendars
   - Phoenix Magazine restaurant news
   - AZCentral & local news sites
   - Eventbrite listings
3. **Write** — Claude writes newsletter in Scottsdale Scoop style
4. **Save** — Edition stored in database as "draft"
5. **Notify** — (Optional) Admin can receive email alert

### Admin Review & Publish

1. Go to `/admin` dashboard
2. See drafts generated this week
3. Preview each edition
4. If happy, click "Publish"
5. Edition immediately appears on public website

### Subscribers See Latest

1. Visit public website
2. See latest published edition
3. Download PDF or copy for email
4. Browse archive by city/date

## Costs

| Item | Cost | Notes |
|------|------|-------|
| Render hosting | $0 | Free tier, 24/7 uptime |
| Claude API | $5-10/month | ~52 generations/year |
| Domain (optional) | $10-15/year | Use free Render subdomain to start |
| **Total MVP** | **~$5-10/month** | Includes API costs |

Scales affordably: even at 1,000 subscribers, costs only ~$20-30/month.

## Next Steps for Business

### MVP Launch
- ✅ Deploy to Render (see DEPLOY_TO_RENDER.md)
- ✅ Test generation & publishing workflow
- ✅ Invite beta testers to public site

### Subscription Model
- Add authentication to protect subscriber content
- Add Stripe for payment processing
- Integrate with Beehiiv or Substack for email delivery
- Track subscriber usage & engagement

### Growth
- Add social media integration (auto-post on Instagram/Facebook)
- Build landing page with testimonials
- Add second East Valley city (Ahwatukee, Tempe, etc.)
- Expand to other Arizona regions

## Security Notes

⚠️ **Important**: The admin dashboard currently has no authentication. Before launching publicly:

1. **Add login** — Protect `/admin` with username/password (bcrypt)
2. **Secure API keys** — Never expose in frontend code
3. **Rate limiting** — Add to `/api/generate` to prevent abuse
4. **Database backup** — Use Render's built-in backups or Supabase

Example auth middleware:
```javascript
const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
app.post('/api/generate', requireAuth, async (req, res) => { ... });
```

## Troubleshooting

**Newsletter generation failing**
- Check Render logs for error messages
- Verify ANTHROPIC_API_KEY is set correctly
- Ensure Claude API isn't rate-limited (wait 60 seconds)

**Scheduled jobs not running**
- Free Render tier doesn't guarantee scheduled job execution
- Solution: Upgrade to Starter tier ($7/month) for reliable scheduling
- Or manually trigger from admin dashboard

**Database lost after redeploy**
- Free Render tier may reset disk
- Solution: Use Supabase PostgreSQL (free tier) for persistent data
- Update `server-cloud.js` to use PostgreSQL instead of SQLite

## Questions?

- **Render docs**: render.com/docs
- **Node.js docs**: nodejs.org
- **Claude API docs**: anthropic.com/api

---

**Built with Claude AI, inspired by the Scottsdale Scoop**
