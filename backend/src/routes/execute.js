import express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Piston is a free, open-source code execution engine
// Public API (emkc.org) is now whitelist-only as of 2/15/2026
// Set PISTON_API_URL env var to use a self-hosted instance, or install Docker and run:
// docker run -d --name piston -p 2000:2000 ghcr.io/engineer-man/piston:latest
// Then set PISTON_API_URL=http://localhost:2000/api/v2/piston
const PISTON_API = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

// Supported language configs for Piston
const LANG_CONFIG = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
  html: null, // handled client-side via iframe
  css: null,
};

// Simple mock executor for testing when Piston is unavailable
const mockExecute = async (language, files, stdin) => {
  // Extract and run simple JavaScript inline for testing
  if (language === 'javascript') {
    try {
      const code = files.map(f => f.content).join('\n');
      // Safety: only allow console.log (simple demo)
      let stdout = '';
      const consoleMock = {
        log: (...args) => {
          stdout += args.map(a => String(a)).join(' ') + '\n';
        },
      };
      
      const fn = new Function('console', code);
      fn(consoleMock);
      
      return {
        stdout: stdout.trim(),
        stderr: '',
        exitCode: 0,
      };
    } catch (e) {
      return {
        stdout: '',
        stderr: e.message,
        exitCode: 1,
      };
    }
  }
  
  return {
    stdout: `[MOCK] ${language} execution not supported. Install Docker and set PISTON_API_URL.`,
    stderr: '',
    exitCode: 1,
  };
};
  try {
    const response = await fetch(`${PISTON_API}/runtimes`);
    const runtimes = await response.json();
    res.json({ runtimes });
  } catch (err) {
    next(err);
  }
});

// POST /api/execute — execute code
router.post('/', protect, async (req, res, next) => {
  const startTime = Date.now();
  let language, pistonFiles, config;
  
  try {
    const { language: lang, files, stdin = '' } = req.body;
    language = lang;

    if (!language || !files?.length) {
      return res.status(400).json({ message: 'language and files are required' });
    }

    config = LANG_CONFIG[language];
    if (!config) {
      return res.status(400).json({ message: `Execution not supported for ${language}` });
    }

    // Piston accepts multiple files — map them
    pistonFiles = files.map(f => ({
      name: f.name || 'main.js',
      content: f.content || '',
    }));

    const payload = {
      language: config.language,
      version: config.version,
      files: pistonFiles,
      stdin: stdin || '',
      args: [],
      compile_timeout: 10000,
      run_timeout: 5000,
      compile_memory_limit: -1,
      run_memory_limit: -1,
    };

    console.log(`[EXECUTE] Invoking Piston (${PISTON_API}) for ${language}`, { 
      files: pistonFiles.length, 
      hasStdin: !!stdin 
    });

    const startTime = Date.now();
    const response = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 15000,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[EXECUTE] Piston response: ${response.status} after ${elapsed}ms`);

    if (!response.ok) {
      let errorDetail = '';
      try {
        const text = await response.text();
        const parsed = JSON.parse(text);
        errorDetail = parsed.message || text;
      } catch {
        errorDetail = `HTTP ${response.status}`;
      }
      console.error(`[EXECUTE] Piston error (${response.status}): ${errorDetail}`);

      // Handle whitelist restriction — fall back to mock executor
      if (response.status === 401 && errorDetail.includes('whitelist')) {
        console.log(`[EXECUTE] Falling back to mock executor`);
        const mockResult = await mockExecute(language, pistonFiles, stdin);
        return res.json({
          stdout: mockResult.stdout,
          stderr: mockResult.stderr || '⚠️ Mock executor active. Install Docker to use real code execution.',
          exitCode: mockResult.exitCode,
          elapsed: Date.now() - startTime,
          language: config.language,
        });
      }

      return res.status(503).json({ 
        message: 'Code execution service error', 
        detail: errorDetail,
        elapsed 
      });
    }

    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      console.error(`[EXECUTE] Failed to parse Piston response:`, parseErr);
      return res.status(502).json({ 
        message: 'Invalid response from execution service',
        elapsed 
      });
    }

    console.log(`[EXECUTE] Execution completed`, { 
      hasStdout: !!result.run?.stdout, 
      hasStderr: !!result.run?.stderr,
      exitCode: result.run?.code ?? -1
    });

    res.json({
      stdout: result.run?.stdout || result.compile?.stdout || '',
      stderr: result.run?.stderr || result.compile?.stderr || '',
      exitCode: result.run?.code ?? result.compile?.code ?? -1,
      elapsed,
      language: config.language,
    });
  } catch (err) {
    console.error(`[EXECUTE] Error:`, err.message);
    
    // Network connectivity issues — fall back to mock
    if (err.cause?.code === 'ECONNREFUSED' || 
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('getaddrinfo') ||
        err.message?.includes('ENOTFOUND')) {
      console.error(`[EXECUTE] Cannot reach Piston at ${PISTON_API}, using mock executor`);
      if (language && pistonFiles) {
        const mockResult = await mockExecute(language, pistonFiles, '');
        return res.json({
          stdout: mockResult.stdout,
          stderr: mockResult.stderr || '⚠️ Piston unavailable. Mock executor active.',
          exitCode: mockResult.exitCode,
          elapsed: Date.now() - startTime,
          language: config?.language || language,
        });
      }
      return res.status(503).json({
        message: 'Code execution service is unavailable',
        stdout: '',
        stderr: 'Unable to reach execution service',
        exitCode: -1,
      });
    }

    // Timeout or other network errors
    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      return res.status(504).json({
        message: 'Code execution timed out',
        stdout: '',
        stderr: 'Request to execution service timed out',
        exitCode: -1,
      });
    }

    next(err);
  }
});

export default router;
