import React, { useState, useEffect } from 'react';
import { Share2, Link, Copy, Check, ToggleLeft, ToggleRight, RefreshCw, X, ExternalLink, Globe, Lock } from 'lucide-react';
import api from '../../utils/api.js';
import toast from 'react-hot-toast';

export default function ShareModal({ projectId, projectName, onClose }) {
  const [status, setStatus] = useState({ isPublic: false, shareUrl: null, shareToken: null });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/share/${projectId}/status`)
      .then(r => setStatus(r.data))
      .catch(() => toast.error('Failed to load share status'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (status.isPublic) {
        const res = await api.post(`/share/${projectId}/disable`);
        setStatus({ isPublic: false, shareUrl: null, shareToken: null });
        toast.success('Sharing disabled');
      } else {
        const res = await api.post(`/share/${projectId}/enable`);
        setStatus(res.data);
        toast.success('Project is now public!');
      }
    } catch {
      toast.error('Failed to update sharing');
    } finally {
      setToggling(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate link? The old link will stop working.')) return;
    setToggling(true);
    try {
      const res = await api.post(`/share/${projectId}/regenerate`);
      setStatus(res.data);
      toast.success('New link generated');
    } catch {
      toast.error('Failed to regenerate link');
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async () => {
    if (!status.shareUrl) return;
    await navigator.clipboard.writeText(status.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-panel animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Share2 size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Share Project</h2>
              <p className="text-xs text-text-secondary truncate max-w-[200px]">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-panel border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status.isPublic ? 'bg-accent/10 border border-accent/20' : 'bg-panel border border-border'}`}>
                  {status.isPublic ? <Globe size={15} className="text-accent" /> : <Lock size={15} className="text-text-muted" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {status.isPublic ? 'Public — anyone with the link can view' : 'Private — only you can access'}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">Read-only for visitors</div>
                </div>
              </div>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`flex-shrink-0 transition-colors ${toggling ? 'opacity-50' : ''}`}
              >
                {status.isPublic
                  ? <ToggleRight size={32} className="text-accent" />
                  : <ToggleLeft size={32} className="text-text-muted" />}
              </button>
            </div>

            {/* Share URL */}
            {status.isPublic && status.shareUrl && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-widest">Share URL</label>
                <div className="flex items-center gap-2 p-3 bg-panel border border-border rounded-lg">
                  <Link size={13} className="text-text-muted flex-shrink-0" />
                  <span className="flex-1 text-xs font-mono text-text-secondary truncate">{status.shareUrl}</span>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                      copied ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-panel border border-border text-text-secondary hover:text-text-primary hover:border-border/80'
                    }`}
                  >
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(status.shareUrl, '_blank')}
                    className="btn-ghost flex items-center gap-1.5 text-xs border border-border flex-1 justify-center py-2"
                  >
                    <ExternalLink size={12} /> Open in new tab
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={toggling}
                    className="btn-ghost flex items-center gap-1.5 text-xs border border-border flex-1 justify-center py-2 hover:text-amber-accent"
                  >
                    <RefreshCw size={12} className={toggling ? 'animate-spin' : ''} /> New link
                  </button>
                </div>

                <p className="text-xs text-text-muted text-center">
                  Visitors can read files and code but cannot edit or run
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
