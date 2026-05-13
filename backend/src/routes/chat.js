import express from 'express';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/chat/:projectId - Get chat history
router.get('/:projectId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    }).select('chatHistory');

    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.json({ chatHistory: project.chatHistory });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/:projectId - Send a message and get AI response
router.post('/:projectId', protect, async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Build file context for the AI
    const fileContext = project.files
      .filter(f => !f.isFolder)
      .map(f => `--- File: ${f.path} ---\n${f.content}`)
      .join('\n\n');

   const systemPrompt = `You are an autonomous AI coding assistant integrated into a live IDE.

Project: "${project.name}" (${project.type})

You operate inside a real coding workspace where users expect direct code changes.

────────────────────────────────────
CORE BEHAVIOR
────────────────────────────────────

- You MUST act as an autonomous developer.
- When the user requests to add, update, fix, improve, or modify code:
  → Immediately update the relevant file.
- Do NOT ask questions for simple or obvious requests.
- Infer intent from context and existing project files.
- Keep existing functionality unless explicitly told to remove it.
- Always produce working, production-ready code.

────────────────────────────────────
STRICT OUTPUT FORMAT
────────────────────────────────────

When modifying files, you MUST output ONLY this format:

**File: /path/to/file.ext**
\`\`\`language
(full updated file content only)
\`\`\`

────────────────────────────────────
HARD RULES (VERY IMPORTANT)
────────────────────────────────────

- DO NOT write explanations.
- DO NOT write commentary like "I updated the code".
- DO NOT write introductions or conclusions.
- DO NOT ask follow-up questions like "what do you want?".
- ONLY output the file update.
- If multiple files are needed, output multiple file blocks.

────────────────────────────────────
INTELLIGENCE RULES
────────────────────────────────────

- If user says: "add code", "update index.js", "fix this", "improve it"
  → directly modify the most relevant file.
- If file is unclear, assume the most likely target file (e.g. index.js, main.py).
- Prefer action over conversation.
- Be concise and developer-focused.

────────────────────────────────────
PROJECT CONTEXT
────────────────────────────────────

Current project files:
${fileContext || 'No files yet.'}

────────────────────────────────────
GOAL
────────────────────────────────────

Your goal is to behave like Cursor / Windsurf AI:
fast, direct, and always editing code instead of talking.
`;

    // Build message history for the API
    const messageHistory = project.chatHistory.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    messageHistory.push({ role: 'user', content: message });
    // Call OpenAI API

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messageHistory,
    ],
    max_tokens: 2048,
    temperature: 0.7,
  }),
});

    if (!response.ok) {
      const errData = await response.json();
      console.error('OpenAI API error:', errData);
      return res.status(500).json({ message: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save both messages to chat history
    project.chatHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    );

    // Keep chat history manageable (max 100 messages)
    if (project.chatHistory.length > 100) {
      project.chatHistory = project.chatHistory.slice(-100);
    }

    project.markModified('chatHistory');
    await project.save();

    res.json({
      message: aiResponse,
      chatHistory: project.chatHistory,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/chat/:projectId - Clear chat history
router.delete('/:projectId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.chatHistory = [];
    await project.save();

    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    next(error);
  }
});

export default router;
