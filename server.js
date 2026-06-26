require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json({ limit: "500kb" }));
app.use(express.static(__dirname));

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const SYSTEM_PROMPT = `
You are an expert ATS resume optimizer.

Analyze the resume against the provided job description.

Return ONLY valid JSON.

{
  "name": "Full Name",
  "contact": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "summary": "",
  "experience": [
    {
      "company": "",
      "title": "",
      "dates": "",
      "location": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "dates": "",
      "details": ""
    }
  ],
  "skills": [],
  "keywords_added": [],
  "match_score_before": 0,
  "match_score_after": 0
}

Rules:

- Never invent companies.
- Improve wording.
- Add ATS keywords naturally.
- Quantify achievements where possible.
- Return ONLY JSON.
- A4 size
- Dont mix work experiences
`;

app.post("/api/optimize", async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        error: "Missing resumeText or jobDescription.",
      });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({
        error: "GOOGLE_API_KEY not configured.",
      });
    }

    const prompt = `
RESUME

${resumeText}

--------------------------

JOB DESCRIPTION

${jobDescription}

Optimize the resume.

Return ONLY JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
      },
      contents: prompt,
    });

    const raw = response.text.trim();

    const clean = raw
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error(clean);
      return res.status(500).json({
        error: "Gemini returned invalid JSON.",
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message || "Unexpected server error.",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ ResumeAI running on port ${PORT}`);
});