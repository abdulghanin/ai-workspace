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

    const systemPrompt = `You are an expert AI coding assistant integrated into a ${project.type} development workspace.

Project: "${project.name}" (${project.type})
Project files are provided below for context.

Your role:
- Answer questions about the code clearly and concisely
- Suggest improvements with specific code examples
- Explain errors and how to fix them
- Help debug issues
- When asked to modify a file, provide the complete updated file content in a code block

Current project files:
${fileContext || 'No files yet.'}

When providing code changes, format them like:
**File: /path/to/file.ext**
\`\`\`language
// complete file content here
\`\`\`

Always be helpful, precise, and focused on the user's specific question.`;

    // Build message history for the API
    const messageHistory = project.chatHistory.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    messageHistory.push({ role: 'user', content: message });

    const openaiKey = process.env.OPENAI_API_KEY;
    
    let aiResponse;

    if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messageHistory,
          ],
          max_tokens: 1024,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error('OpenAI API error:', errData);
        return res.status(500).json({ message: 'AI service error. Please try again.' });
      }

      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
    } else if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: messageHistory,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error('Anthropic API error:', errData);
        return res.status(500).json({ message: 'AI service error. Please try again.' });
      }

      const data = await response.json();
      aiResponse = data.content[0]?.text || 'Sorry, I could not generate a response.';
    } else {
      return res.status(500).json({ message: 'AI API key not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.' });
    }

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
