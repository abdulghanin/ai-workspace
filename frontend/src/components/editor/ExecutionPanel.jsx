import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, ChevronDown, Terminal } from 'lucide-react';
import api from '../../utils/api.js';
import toast from 'react-hot-toast';

const ANSI_COLORS = {
  '\x1b[31m': 'text-red-400',    // red
  '\x1b[32m': 'text-green-400',  // green
  '\x1b[33m': 'text-amber-accent', // yellow
  '\x1b[34m': 'text-blue-accent', // blue
  '\x1b[0m': '',
};

function TerminalLine({ text, type }) {
  const colorClass = type === 'stderr'
    ? 'text-red-400'
    : type === 'system'
    ? 'text-text-muted italic'
    : type === 'success'
    ? 'text-accent'
    : 'text-text-primary';

  return (
    <div className={`font-mono text-xs leading-relaxed whitespace-pre-wrap ${colorClass}`}>
      {type === 'stderr' && <span className="text-red-500 mr-1">[stderr]</span>}
      {text}
    </div>
  );
}

export default function ExecutionPanel({ files, projectType, visible, onToggle }) {
  const [output, setOutput] = useState([]);
  const [running, setRunning] = useState(false);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const canExecute = projectType === 'javascript' || projectType === 'python';

  const handleRun = async () => {
    if (!canExecute) {
      toast.error('Execution only available for JavaScript and Python projects');
      return;
    }

    setRunning(true);
    setOutput(prev => [
      ...prev,
      { type: 'system', text: `▶ Running ${projectType}...`, id: Date.now() },
    ]);

    const execFiles = files
      .filter(f => !f.isFolder)
      .map(f => ({ name: f.name, content: f.content || '' }));

    const startTime = Date.now();

    try {
      const res = await api.post('/execute', {
        language: projectType,
        files: execFiles,
        stdin,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (res.data.stdout) {
        setOutput(prev => [...prev, { type: 'stdout', text: res.data.stdout, id: Date.now() + 1 }]);
      }
      if (res.data.stderr) {
        setOutput(prev => [...prev, { type: 'stderr', text: res.data.stderr, id: Date.now() + 2 }]);
      }
      if (!res.data.stdout && !res.data.stderr) {
        setOutput(prev => [...prev, { type: 'system', text: '(no output)', id: Date.now() + 3 }]);
      }

      const exitType = res.data.exitCode === 0 ? 'success' : 'stderr';
      setOutput(prev => [...prev, {
        type: exitType,
        text: `✓ Exited with code ${res.data.exitCode} in ${elapsed}s`,
        id: Date.now() + 4,
      }]);
    } catch (err) {
      setOutput(prev => [...prev, {
        type: 'stderr',
        text: err.response?.data?.message || 'Execution failed',
        id: Date.now() + 5,
      }]);
    } finally {
      setRunning(false);
    }
  };

  const handleClear = () => setOutput([]);

  if (!visible) return null;

  return (
    <div className="flex flex-col bg-void border-t border-border/50" style={{ height: '220px' }}>
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/50 bg-surface/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-accent" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStdin(!showStdin)}
            className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-secondary hover:bg-panel transition-colors"
            title="Toggle stdin input"
          >
            stdin
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-panel transition-colors"
            title="Clear"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-panel transition-colors"
          >
            <ChevronDown size={13} />
          </button>
          <button
            onClick={handleRun}
            disabled={running || !canExecute}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              !canExecute
                ? 'opacity-30 cursor-not-allowed text-text-muted'
                : running
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-accent text-void hover:bg-accent/90'
            }`}
          >
            {running ? <><Square size={11} fill="currentColor" /> Stop</> : <><Play size={11} fill="currentColor" /> Run</>}
          </button>
        </div>
      </div>

      {/* Stdin input */}
      {showStdin && (
        <div className="px-4 py-2 border-b border-border/50 bg-panel/30">
          <input
            className="w-full bg-transparent font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            placeholder="stdin input (press Enter to confirm)..."
            value={stdin}
            onChange={e => setStdin(e.target.value)}
          />
        </div>
      )}

      {/* Output */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
        {output.length === 0 && (
          <div className="text-xs text-text-muted font-mono italic mt-2">
            {canExecute
              ? `Press Run to execute your ${projectType} code`
              : 'Live preview available for website projects — use the eye icon above'}
          </div>
        )}
        {output.map(line => (
          <TerminalLine key={line.id} text={line.text} type={line.type} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
