import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/anthropic/messages', async (req, res) => {
  const userKey = req.headers['x-api-key'];
  const serverKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = userKey && userKey.trim() !== '' ? userKey : serverKey;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API Key. Provide it in settings or set ANTHROPIC_API_KEY on the server." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Anthropic proxy error:", error);
    res.status(500).json({ error: "Internal Server Error proxying to Anthropic" });
  }
});

app.post('/api/openai/completions', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const userKey = authHeader ? authHeader.replace('Bearer ', '') : '';
  const serverKey = process.env.OPENAI_API_KEY;
  const apiKey = userKey && userKey.trim() !== '' ? userKey : serverKey;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API Key. Provide it in settings or set OPENAI_API_KEY on the server." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("OpenAI proxy error:", error);
    res.status(500).json({ error: "Internal Server Error proxying to OpenAI" });
  }
});

app.post('/api/gemini/messages', async (req, res) => {
  const userKey = req.headers['x-gemini-key'];
  const serverKey = process.env.GEMINI_API_KEY;
  const apiKey = (userKey && userKey.trim() !== '') ? userKey : serverKey;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing Gemini API Key. Get a free one at aistudio.google.com/apikey and add GEMINI_API_KEY to your .env file." });
  }

  // The frontend sends OpenAI-format messages; translate to Gemini format
  const { messages, system } = req.body;

  // Build the contents array for Gemini
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const geminiBody = {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: 4000,
      temperature: 0.7,
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    // Map response back to OpenAI-like shape so frontend can reuse same parsing
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({
      choices: [{ message: { content: text } }]
    });
  } catch (error) {
    console.error("Gemini proxy error:", error);
    res.status(500).json({ error: "Internal Server Error proxying to Gemini" });
  }
});

app.post('/api/groq/messages', async (req, res) => {
  const serverKey = process.env.GROQ_API_KEY;
  if (!serverKey) {
    return res.status(401).json({ error: "Missing GROQ_API_KEY in .env — get a free key at console.groq.com" });
  }

  const { messages, system } = req.body;
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serverKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 4000,
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }
    res.json(data);
  } catch (error) {
    console.error('Groq proxy error:', error);
    res.status(500).json({ error: 'Internal Server Error proxying to Groq' });
  }
});

// Proxy for Polymarket Gamma API (avoids CORS)
app.get('/api/polymarket/events', async (req, res) => {
  try {
    const params = new URLSearchParams(req.query).toString();
    const response = await fetch(`https://gamma-api.polymarket.com/events?${params}`);
    if (!response.ok) return res.status(response.status).json([]);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Polymarket proxy error:', err);
    res.status(500).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
});
