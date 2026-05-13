import express from 'express';
import { NodeVM } from 'vm2';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const stringify = (v) => {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'object') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
};

/** Unified result shape returned by every executor */
const result = (stdout, stderr, exitCode, elapsed) => ({
  stdout:   String(stdout  ?? '').trimEnd(),
  stderr:   String(stderr  ?? '').trimEnd(),
  exitCode: Number(exitCode ?? -1),
  elapsed:  Number(elapsed  ?? 0),
});

// ─────────────────────────────────────────────────────────────────────────────
// JavaScript executor — vm2 NodeVM sandbox
// Two-pass strategy:
//   Pass 1  Evaluate every non-entry .js file in its own NodeVM → capture exports
//   Pass 2  Run entry file with those exports injected via require.mock
// Blocked: fs, child_process, net, os, http — anything not in BUILTINS
// Timeout: 5 s
// ─────────────────────────────────────────────────────────────────────────────

const BUILTINS_JS = [
  'assert', 'buffer', 'crypto', 'events',
  'path',   'querystring', 'stream', 'string_decoder',
  'url',    'util',
];

const executeJS = (files) => {
  const t0      = Date.now();
  const jsFiles = files.filter(f => f.name?.endsWith('.js'));
  const entry   = jsFiles.find(f => f.name === 'index.js') || jsFiles[0];

  if (!entry) {
    return result('', 'No .js entry file found in project.', 1, 0);
  }

  const lines    = [];
  const errLines = [];

  // ── Pass 1: build module mock map ─────────────────────────────────────────
  const requireMock = {};

  for (const file of jsFiles) {
    if (file.name === entry.name) continue;
    const key = file.name.replace(/\.js$/, '');
    let exports = {};
    try {
      const modVm = new NodeVM({
        timeout: 3000,
        sandbox: {},
        console: 'off',
        require: { external: false, builtin: BUILTINS_JS },
      });
      exports = modVm.run(file.content, file.name) ?? {};
    } catch (e) {
      errLines.push(`[module error: ${file.name}] ${e.message}`);
    }
    requireMock[`./${key}`]    = exports;
    requireMock[`./${key}.js`] = exports;
    requireMock[key]           = exports;
  }

  // ── Pass 2: run entry ──────────────────────────────────────────────────────
  let exitCode = 0;
  try {
    const vm = new NodeVM({
      timeout: 5000,
      sandbox: {},
      console: 'redirect',
      require: {
        external: false,
        builtin:  BUILTINS_JS,
        mock:     requireMock,
      },
    });

    vm.on('console.log',   (...a) => lines.push(a.map(stringify).join(' ')));
    vm.on('console.info',  (...a) => lines.push(a.map(stringify).join(' ')));
    vm.on('console.warn',  (...a) => lines.push('[warn] '  + a.map(stringify).join(' ')));
    vm.on('console.error', (...a) => errLines.push(a.map(stringify).join(' ')));
    vm.on('console.dir',   (o)    => lines.push(stringify(o)));

    vm.run(entry.content, entry.name);
  } catch (err) {
    exitCode = err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 124 : 1;
    errLines.push(
      exitCode === 124
        ? 'Execution timed out (5 s limit exceeded)'
        : `${err.constructor?.name ?? 'Error'}: ${err.message}`
    );
  }

  return result(lines.join('\n'), errLines.join('\n'), exitCode, Date.now() - t0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Python executor — child_process subprocess
// Strategy:
//   1. Write entry source to a temp file (UTF-8)
//   2. Prepend a safety shim that shadows dangerous builtins
//   3. Spawn  python3 <tempfile>  with spawnSync (blocks, timeout enforced)
//   4. Capture stdout / stderr / exit code
//   5. Delete temp file in finally block
// Blocked builtins: os.system, subprocess, open (write mode), __import__ of banned mods
// Timeout: 5 s
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the correct Python binary for the current OS.
 * Priority order:
 *   Windows  → py  → python  → python3
 *   Unix     → python3  → python
 * Each candidate is probed with --version; first one that exits cleanly wins.
 * If none found, PYTHON_BINARY is null and executePython() returns a clear error.
 */
const PYTHON_BINARY = (() => {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const bin of candidates) {
    const probe = spawnSync(bin, ['--version'], {
      timeout: 2000,
      windowsHide: true,     // suppress cmd flash on Windows
    });
    // error means the binary wasn't found; non-zero status is still a real Python
    if (!probe.error) {
      const version = (probe.stdout?.toString() || probe.stderr?.toString() || '').trim();
      console.log(`[EXECUTE] Python binary resolved: ${bin} (${version})`);
      return bin;
    }
  }

  console.warn('[EXECUTE] No Python binary found on this system.');
  return null;
})();

/** Safety shim injected at the top of every user script.
 *  Double-underscore prefix makes shim names invisible / unlikely to clash.
 *  We do NOT del __orig_import__ because _safe_import's closure still needs it. */
const PYTHON_SAFETY_SHIM = `
import builtins as __builtins_ref__

__orig_import__ = __builtins_ref__.__import__

def __safe_import__(name, *args, **kwargs):
    __BLOCKED__ = frozenset({
        'subprocess', 'socket', 'socketserver', 'http', 'urllib',
        'ftplib', 'smtplib', 'telnetlib', 'xmlrpc', 'multiprocessing',
        'threading', 'ctypes', 'mmap',
    })
    if name.split('.')[0] in __BLOCKED__:
        raise ImportError(f"import '{name}' is blocked in the sandbox")
    return __orig_import__(name, *args, **kwargs)

__builtins_ref__.__import__ = __safe_import__

import os as __os__
__os__.system = lambda *a, **k: (_ for _ in ()).throw(PermissionError("os.system is blocked"))
__os__.popen  = lambda *a, **k: (_ for _ in ()).throw(PermissionError("os.popen is blocked"))
__os__.execv  = lambda *a, **k: (_ for _ in ()).throw(PermissionError("os.execv is blocked"))
__os__.execve = lambda *a, **k: (_ for _ in ()).throw(PermissionError("os.execve is blocked"))
__os__.fork   = lambda *a, **k: (_ for _ in ()).throw(PermissionError("os.fork is blocked"))
__os__.spawn  = None

# Clean up shim names — keep __orig_import__ alive (closure dependency)
del __os__, __builtins_ref__, __safe_import__
# ── user code begins ──────────────────────────────────────────────────────────
`.trimStart();

const executePython = (files, stdin) => {
  const t0 = Date.now();

  if (!PYTHON_BINARY) {
    return result(
      '',
      [
        'Python is not installed or not found on PATH.',
        '',
        'Install Python from https://www.python.org/downloads/',
        'On Windows, make sure to check "Add Python to PATH" during installation.',
        'Then restart the backend server.',
      ].join('\n'),
      1,
      0,
    );
  }

  const entry = files.find(f => f.name === 'main.py')
             || files.find(f => f.name?.endsWith('.py'));

  if (!entry) {
    return result('', 'No .py entry file found in project.', 1, 0);
  }

  const source = PYTHON_SAFETY_SHIM + (entry.content ?? '');
  let   tmpDir, tmpFile;

  try {
    tmpDir  = mkdtempSync(join(tmpdir(), 'devmind-py-'));
    tmpFile = join(tmpDir, 'main.py');
    writeFileSync(tmpFile, source, 'utf8');

    // Build a minimal env that works on both Windows and Unix
    const safeEnv = {
      PATH:                    process.env.PATH,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONIOENCODING:        'utf-8',
      // Windows needs these or certain stdlib modules fail
      ...(process.platform === 'win32' && {
        SYSTEMROOT:  process.env.SYSTEMROOT  || 'C:\\Windows',
        USERPROFILE: process.env.USERPROFILE || '',
        APPDATA:     process.env.APPDATA     || '',
        TEMP:        process.env.TEMP        || tmpdir(),
        TMP:         process.env.TMP         || tmpdir(),
      }),
    };

    const proc = spawnSync(PYTHON_BINARY, [tmpFile], {
      input:       stdin || '',
      timeout:     5000,
      encoding:    'utf8',
      windowsHide: true,   // no cmd.exe flash on Windows
      env:         safeEnv,
    });

    const timedOut = proc.error?.code === 'ETIMEDOUT' || proc.signal === 'SIGTERM';

    return result(
      proc.stdout ?? '',
      timedOut
        ? 'Execution timed out (5 s limit exceeded)'
        : (proc.stderr ?? ''),
      timedOut ? 124 : (proc.status ?? 1),
      Date.now() - t0,
    );
  } finally {
    // Always clean up — even if an exception is thrown above
    try { if (tmpFile) unlinkSync(tmpFile); }   catch { /* ignore */ }
    try { if (tmpDir)  rmdirSync(tmpDir);   }   catch { /* ignore */ }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * executeCode(language, files, stdin) → { stdout, stderr, exitCode, elapsed }
 * Extensible: add a new case here to support more languages.
 */
const executeCode = (language, files, stdin = '') => {
  switch (language) {
    case 'javascript':
      return executeJS(files);
    case 'python':
      return executePython(files, stdin);
    default:
      return result(
        '',
        `Language '${language}' is not supported. Supported: javascript, python.`,
        1,
        0,
      );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Express route
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/execute
router.post('/', protect, (req, res) => {
  const { language, files, stdin = '' } = req.body;

  if (!language || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      message: '`language` and a non-empty `files` array are required.',
    });
  }

  console.log(`[EXECUTE] ${language} — ${files.length} file(s)`);

  const output = executeCode(language, files, stdin);

  console.log(
    `[EXECUTE] done — exit ${output.exitCode} in ${output.elapsed} ms`
  );

  return res.json(output);
});

export default router;
