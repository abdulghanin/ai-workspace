import React, { useState, useEffect } from 'react';
import { GitBranch, RotateCcw, Plus, Trash2, Clock, ChevronRight, X, FileCode } from 'lucide-react';
import api from '../../utils/api.js';
import toast from 'react-hot-toast';

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function VersionPanel({ projectId, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    fetchVersions();
  }, [projectId]);

  const fetchVersions = async () => {
    try {
      const res = await api.get(`/versions/${projectId}`);
      setVersions(res.data.versions);
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!message.trim()) return toast.error('Please enter a version message');
    setSaving(true);
    try {
      const res = await api.post(`/versions/${projectId}`, { message: message.trim() });
      setVersions(prev => [res.data.version, ...prev]);
      setMessage('');
      toast.success('Version saved!');
    } catch {
      toast.error('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version) => {
    if (!window.confirm(`Restore to "${version.message}"? Current files will be auto-saved as a version first.`)) return;
    setRestoring(version._id);
    try {
      const res = await api.post(`/versions/${projectId}/${version._id}/restore`);
      onRestore(res.data.files);
      toast.success('Restored! Previous state auto-saved.');
      fetchVersions();
    } catch {
      toast.error('Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (versionId) => {
    if (!window.confirm('Delete this version?')) return;
    try {
      await api.delete(`/versions/${projectId}/${versionId}`);
      setVersions(prev => prev.filter(v => v._id !== versionId));
      toast.success('Version deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const loadDetail = async (version) => {
    if (expanded === version._id) { setExpanded(null); setVersionDetail(null); return; }
    setExpanded(version._id);
    try {
      const res = await api.get(`/versions/${projectId}/${version._id}`);
      setVersionDetail(res.data.version);
    } catch {
      toast.error('Failed to load version details');
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Version History</span>
          <span className="text-xs text-text-muted bg-panel border border-border rounded-full px-2">{versions.length}</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      {/* Save new version */}
      <div className="px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex gap-2">
          <input
            className="input-field flex-1 py-2 text-sm"
            placeholder="Version message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !message.trim()}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs flex-shrink-0"
          >
            {saving
              ? <div className="w-3 h-3 rounded-full border border-void border-t-transparent animate-spin" />
              : <><Plus size={13} /> Save</>}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-1.5">Saves a snapshot of all current files</p>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 px-4">
            <GitBranch size={28} className="text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-text-secondary text-sm font-medium">No versions yet</p>
            <p className="text-text-muted text-xs mt-1">Save a version to create a restore point</p>
          </div>
        ) : (
          <div className="py-1">
            {versions.map((v, i) => (
              <div key={v._id} className="border-b border-border/30 last:border-0">
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-panel/40 cursor-pointer group"
                  onClick={() => loadDetail(v)}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? 'bg-accent border-accent' : 'bg-transparent border-text-muted'}`} />
                    {i < versions.length - 1 && <div className="w-px h-8 bg-border mt-0.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{v.message}</span>
                      {i === 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 flex-shrink-0">latest</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Clock size={10} /> {timeAgo(v.createdAt)}
                      </span>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <FileCode size={10} /> {v.fileCount} files
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); handleRestore(v); }}
                      disabled={restoring === v._id}
                      className="p-1.5 rounded hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                      title="Restore this version"
                    >
                      {restoring === v._id
                        ? <div className="w-3 h-3 rounded-full border border-accent border-t-transparent animate-spin" />
                        : <RotateCcw size={13} />}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(v._id); }}
                      className="p-1.5 rounded hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                      title="Delete version"
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight
                      size={13}
                      className={`text-text-muted transition-transform ${expanded === v._id ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded file list */}
                {expanded === v._id && versionDetail && (
                  <div className="px-4 pb-3 bg-panel/20">
                    <div className="text-xs font-medium text-text-muted uppercase tracking-widest mb-2">Files in this version</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {versionDetail.files?.filter(f => !f.isFolder).map(f => (
                        <div key={f.path} className="flex items-center gap-2 text-xs text-text-secondary font-mono py-0.5">
                          <FileCode size={11} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{f.path}</span>
                          <span className="text-text-muted ml-auto flex-shrink-0">{(f.content?.length || 0).toLocaleString()} chars</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
