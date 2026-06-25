const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cron = require('node-cron');
const PDFDocument = require('pdfkit');

require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE SETUP
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query(`
  CREATE TABLE IF NOT EXISTS editions (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    week_of TEXT NOT NULL,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL,
    status TEXT DEFAULT 'draft'
  )
`).catch(err => console.error('Table creation error:', err));

// HELPER FUNCTIONS
async function callClaude(body) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function generateNewsletter(city) {
  const SOURCES = {
    'Gilbert': 'gilbert.macaronikid.com, yourvalley.net/gilbert-independent, discovergilbert.com, phoenixmag.com, azcentral.com, queencreektribune.com',
    'Chandler': 'chandler.macaronikid.com, visitchandler.com/events, citysuntimes.com, phoenixmag.com, azcentral.com, yourvalley.net',
    'Queen Creek': 'queencreek.macaronikid.com, queencreekchamber.com, queencreektribune.com, phoenixmag.com, azcentral.com',
    'San Tan Valley': 'queencreek.macaronikid.com, citysuntimes.com, queencreekchamber.com, phoenixmag.com, azcentral.com'
  };

  const src = SOURCES[city] || SOURCES['Gilbert'];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const d1 = await callClaude({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Search for family-friendly content in ${city}, Arizona for the week of ${today}. Sources: ${src}\n\nFind and summarize in plain text:\n1. 3 family events this week\n2. 2 restaurant openings or food news\n3. 2 kids activities\n4. 1 community note\n5. Weather: One sentence.\n\nFocus on experience and appeal, not just logistics.`
    }]
  });

  const research = d1.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!research) throw new Error('No research returned');

  const d2 = await callClaude({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Write a Scottsdale Scoop style newsletter for ${city}. Warm, conversational, light-hearted, meant for families.\n\nResearch:\n${research}\n\nReturn ONLY raw JSON:\n{"city":"${city}","week_of":"${today}","weather":"one sentence","greeting":"warm 2-sentence opener","events":[{"name":"","address":"","url":"","image":"","body":"2-3 sentences"}],"dining":[{"name":"","address":"","url":"","image":"","body":"2-3 sentences"}],"activities":[{"name":"","address":"","url":"","image":"","body":"2-3 sentences"}],"community":[{"name":"","address":"","url":"","image":"","body":"1-2 sentences"}]}\n\nFor each item include:
- name: Business or event name
- address: Full address if available
- url: Business website (working site only, or empty string)
- image: Search for a high-quality image URL of the business/event/place. Look for images from Google Images, Yelp, TripAdvisor, or the business website. Must be a real, working image URL that displays the business, product, or venue. Examples: https://example.com/photo.jpg. Include images whenever possible - they make the newsletter visually appealing. If you cannot find a working image URL, use empty string.
- body: Description (2-3 sentences)

PRIORITY: Include images for every item. Search specifically for "[business name] photo", "[event name] image", or "[place name] picture" to find good URLs.`
    }]
  });

  const raw = d2.content.filter(b => b.type === 'text').map(b => b.text).join('').replace(/```json|```/g, '').trim();
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('No JSON returned');
  return JSON.parse(raw.slice(s, e + 1));
}

// API ENDPOINTS
app.get('/api/latest', async (req, res) => {
  try {
    const city = req.query.city;
    let query = 'SELECT * FROM editions WHERE status = $1 ORDER BY published_at DESC LIMIT 1';
    let params = ['published'];
    if (city) {
      query = 'SELECT * FROM editions WHERE status = $1 AND city = $2 ORDER BY published_at DESC LIMIT 1';
      params = ['published', city];
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0] || { error: 'No published editions yet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/editions', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, city, week_of, published_at FROM editions ORDER BY published_at DESC');
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/editions/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM editions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Edition not found' });
    res.json(result.rows[0].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const { city } = req.body;
  if (!city) return res.status(400).json({ error: 'City required' });

  try {
    const data = await generateNewsletter(city);
    const result = await pool.query(
      'INSERT INTO editions (city, week_of, data, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [city, data.week_of, JSON.stringify(data), 'draft']
    );
    res.json({ id: result.rows[0].id, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/editions/:id/publish', async (req, res) => {
  try {
    await pool.query('UPDATE editions SET status = $1 WHERE id = $2', ['published', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/editions/:id', async (req, res) => {
  try {
    const { data } = req.body;
    await pool.query('UPDATE editions SET data = $1 WHERE id = $2', [JSON.stringify(data), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/editions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM editions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/editions/:id/html', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM editions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Edition not found' });
    
    const data = result.rows[0].data;
    const sections = [
      { title: '📅 Events', items: data.events },
      { title: '🍽️ Food & Dining', items: data.dining },
      { title: '🏃 Activities', items: data.activities },
      { title: '🏡 Community', items: data.community }
    ];

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
.container{max-width:600px;margin:0 auto;background:#fff;padding:30px}
.header{background:#2D6A4F;color:#fff;padding:20px;text-align:center}
.section{margin:25px 0;padding:15px;background:#f9f9f9;border-left:4px solid #2D6A4F}
.section-title{font-weight:700;color:#2D6A4F;margin-bottom:12px;font-size:13px;text-transform:uppercase}
.item{margin-bottom:15px}
.item-name{font-weight:600;color:#1A1A1A}
.item-address{font-size:12px;color:#7A7A7A;font-style:italic}
.item-body{font-size:13px;margin-top:4px}
</style></head><body><div class="container"><div class="header"><h1>San Tan Family Pulse 🌵</h1></div>
<p><strong>${data.city}</strong> | Week of ${data.week_of}</p>
<p><strong>Good morning, ${data.city}! 👋</strong></p>
<p>${data.greeting}</p>`;

    if (data.weather) html += `<p style="background:#EDF3FA;padding:12px;border-radius:4px">☀️ ${data.weather}</p>`;
    
    sections.forEach(s => {
      if (s.items && s.items.length) {
        html += `<div class="section"><div class="section-title">${s.title}</div>`;
        s.items.forEach(item => {
          html += `<div class="item"><div class="item-name">${item.url ? `<a href="${item.url}">${item.name}</a>` : item.name}</div>`;
          if (item.address) html += `<div class="item-address">${item.address}</div>`;
          html += `<div class="item-body">${item.body}</div></div>`;
        });
        html += `</div>`;
      }
    });
    
    html += `</div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/editions/:id/pdf', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM editions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Edition not found' });

    const data = result.rows[0].data;
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="newsletter-${data.city}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(28).font('Helvetica-Bold').text('San Tan Family Pulse', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(data.city, { align: 'center' });
    doc.fontSize(10).text(`Week of ${data.week_of}`, { align: 'center' });
    doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke();
    doc.moveDown(1);

    // Greeting
    doc.fontSize(12).text(data.greeting);
    doc.moveDown();

    // Weather
    if (data.weather) {
      doc.fontSize(11).text(`Weather: ${data.weather}`);
      doc.moveDown();
    }

    // Sections
    const sections = [
      { title: 'Events This Week', items: data.events },
      { title: 'Food & Restaurant News', items: data.dining },
      { title: 'Things to Do with Kids', items: data.activities },
      { title: 'Around the Neighborhood', items: data.community }
    ];

    sections.forEach(section => {
      if (section.items?.length) {
        doc.moveDown(0.5);
        doc.fontSize(13).font('Helvetica-Bold').text(section.title);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        
        section.items.forEach(item => {
          doc.fontSize(11).font('Helvetica-Bold').text(item.name);
          if (item.address) {
            doc.fontSize(9).font('Helvetica-Oblique').text(item.address);
          }
          doc.fontSize(10).font('Helvetica').text(item.body);
          doc.moveDown(0.5);
        });
      }
    });

    // Footer
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.fontSize(9).text('San Tan Family Pulse — Weekly family guide for Gilbert, Chandler, Queen Creek & San Tan Valley', { align: 'center' });
    
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SCHEDULER
cron.schedule('0 8 * * 4', async () => {
  console.log('Running scheduled generation...');
  const cities = ['Gilbert', 'Chandler', 'Queen Creek', 'San Tan Valley'];
  for (const city of cities) {
    try {
      const data = await generateNewsletter(city);
      await pool.query(
        'INSERT INTO editions (city, week_of, data, status) VALUES ($1, $2, $3, $4)',
        [city, data.week_of, JSON.stringify(data), 'draft']
      );
      console.log(`Generated draft for ${city}`);
    } catch (err) {
      console.error(`Failed for ${city}:`, err.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ San Tan Family Pulse running on port ${PORT}`);
});
