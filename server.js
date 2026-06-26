require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '500kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are an expert ATS resume optimizer. Analyze the resume and optimize it for the job description.
Return ONLY a valid JSON object — no markdown, no code fences, no preamble. Raw JSON only.

Schema:
{
  "name": "Full Name",
  "contact": { "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "2-3 sentence professional summary targeting this specific role",
  "experience": [
    {
      "company": "",
      "title": "",
      "dates": "",
      "location": "",
      "bullets": ["Strong achievement bullet with action verb and metric..."]
    }
  ],
  "education": [{ "school": "", "degree": "", "dates": "", "details": "" }],
  "skills": ["skill1", "skill2"],
  "keywords_added": ["keyword1", "keyword2"],
  "match_score_before": 35,
  "match_score_after": 82
}

Rules:
- Preserve all real experience — never fabricate companies or roles
- Weave JD keywords naturally into existing bullet points
- Strengthen bullets with action verbs: Led, Built, Delivered, Optimized, Spearheaded, Achieved
- Quantify achievements; infer reasonable ranges if none given (e.g. "~30% improvement")
- Rewrite summary to specifically target this role
- match_score_before = realistic % of key JD requirements in original resume (0-100)
- match_score_after = % covered after optimization, meaningfully higher than before
- keywords_added = important JD terms added that were absent from original`;

app.post('/api/optimize', async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'Missing resumeText or jobDescription.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Copy .env.example to .env and add your key.'
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `RESUME:\n${resumeText.slice(0, 6000)}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}\n\nOptimize this resume. Return only the JSON object.`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `Anthropic API error ${response.status}`
      });
    }

    const data = await response.json();
    const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);

    res.json(parsed);
  } catch (err) {
    console.error('Optimization error:', err.message);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
});

// Fallback: serve index.html for any unmatched route (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅  ResumeAI running → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️   ANTHROPIC_API_KEY not set. Copy .env.example → .env and add your key.\n');
  }
});
