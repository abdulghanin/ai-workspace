import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../utils/api.js';
import { Zap, Code2, Globe, Terminal, File, Folder, Lock, ExternalLink } from 'lucide-react';

const LANG_MAP = { javascript: 'javascript', python: 'python', html: 'html', css: 'css', json: 'json', markdown: 'markdown', text: 'plaintext' };
const TYPE_INFO = {
  javascript: { label: 'JavaScript', icon: Code2, color: 'text-amber-accent' },
  python: { label: 'Python', icon: Terminal, color: 'text-blue-accent' },
  website: { label: 'Website Builder', icon: Globe, color: 'text-accent' },
};

function FileTreeItem({ file, files, activeFile, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(depth === 0);
  const children = files.filter(f => f.parentPath === file.path && f._id !== file._id);

  return (
    <div>
      <div
        className={`file-tree-item ${activeFile?._id === file._id ? 'active' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => file.isFolder ? setOpen(!open) : onSelect(file)}
      >
        {file.isFolder
          ? <Folder size={13} className="text-amber-accent/70 flex-shrink-0" />
          : <File size={13} className="text-text-muted flex-shrink-0" />}
        <span className="text-xs truncate">{file.name}</span>
      </div>
      {file.isFolder && open && children.map(c => (
        <FileTreeItem key={c._id} file={c} files={files} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function SharedProjectPage() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/share/view/${token}`)
      .then(res => {
        const proj = res.data.project;
        setProject(proj);
        const first = proj.files?.find(f => !f.isFolder);
        if (first) setActiveFile(first);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-void">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="h-full flex items-center justify-center bg-void text-center px-4">
        <div>
          <Lock size={40} className="text-text-muted mx-auto mb-4 opacity-40" />
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Project not found</h1>
          <p className="text-text-secondary mb-6">This project is private or the share link has been revoked.</p>
          <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
            <ExternalLink size={14} /> Open DevMind
          </Link>
        </div>
      </div>
    );
  }

  const typeInfo = TYPE_INFO[project.type] || TYPE_INFO.javascript;
  const rootFiles = project.files?.filter(f => f.parentPath === '/') || [];

  return (
    <div className="h-full flex flex-col bg-void overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Zap size={14} className="text-accent" />
          </div>
          <span className="font-display text-sm font-bold text-text-primary hidden sm:block">DevMind</span>
        </Link>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <typeInfo.icon size={15} className={typeInfo.color} />
          <span className="text-sm font-semibold text-text-primary truncate">{project.name}</span>
          <span className="text-xs text-text-muted">by {project.owner?.username}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-panel border border-border text-text-muted">
            Read-only
          </span>
          <Link to="/register" className="btn-primary text-xs px-3 py-1.5">
            Fork on DevMind →
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-border/50 bg-surface/20 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border/50">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">Files</span>
          </div>
          <div className="py-1">
            {rootFiles.map(f => (
              <FileTreeItem
                key={f._id}
                file={f}
                files={project.files}
                activeFile={activeFile}
                onSelect={setActiveFile}
              />
            ))}
          </div>
        </div>

        {/* Editor (read-only) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeFile && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-surface/30 flex-shrink-0">
              <span className="text-xs font-mono text-text-secondary">{activeFile.path}</span>
            </div>
          )}
          {activeFile ? (
            <Editor
              height="100%"
              language={LANG_MAP[activeFile.language] || 'plaintext'}
              value={activeFile.content || ''}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16 },
                renderLineHighlight: 'none',
                scrollbar: { vertical: 'auto' },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
