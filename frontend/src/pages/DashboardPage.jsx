import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore.js';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import {
  Zap, LogOut, Plus, Folder, FolderOpen, Trash2, ChevronRight,
  Code2, Globe, Terminal, Clock, X
} from 'lucide-react';

const WORKSPACE_TYPES = [
  {
    id: 'javascript',
    label: 'JavaScript',
    icon: Code2,
    color: 'text-amber-accent',
    bg: 'bg-amber-400/5',
    border: 'border-amber-400/20',
    glow: 'hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(252,211,77,0.1)]',
    desc: 'Node.js, ES modules, modern JS development',
    exts: ['.js', '.mjs', '.json'],
  },
  {
    id: 'python',
    label: 'Python',
    icon: Terminal,
    color: 'text-blue-accent',
    bg: 'bg-blue-400/5',
    border: 'border-blue-400/20',
    glow: 'hover:border-blue-400/40 hover:shadow-[0_0_20px_rgba(96,165,250,0.1)]',
    desc: 'Python 3, scripts, data science, automation',
    exts: ['.py', '.txt', '.json'],
  },
  {
    id: 'website',
    label: 'Website Builder',
    icon: Globe,
    color: 'text-accent',
    bg: 'bg-accent/5',
    border: 'border-accent/20',
    glow: 'hover:border-accent/40 hover:shadow-[0_0_20px_rgba(110,231,183,0.1)]',
    desc: 'HTML, CSS, JavaScript + Tailwind CSS with live preview',
    exts: ['.html', '.css', '.js'],
  },
];

function CreateProjectModal({ type, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const ws = WORKSPACE_TYPES.find(w => w.id === type);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Project name is required');
    setLoading(true);
    try {
      const res = await api.post('/projects', { name: name.trim(), description: desc.trim(), type });
      toast.success('Project created!');
      onCreated(res.data.project);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-panel animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${ws.bg} border ${ws.border} flex items-center justify-center`}>
              <ws.icon size={18} className={ws.color} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">New {ws.label} Project</h2>
              <p className="text-xs text-text-secondary">{ws.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-widest">Project Name</label>
            <input
              autoFocus
              className="input-field"
              placeholder="my-awesome-project"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-widest">Description <span className="normal-case text-text-muted">(optional)</span></label>
            <textarea
              className="input-field resize-none"
              placeholder="What does this project do?"
              rows={2}
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 border border-border">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 rounded-full border-2 border-void border-t-transparent animate-spin" /> : <>Create <Plus size={14} /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen, onDelete }) {
  const typeMap = { javascript: { icon: Code2, color: 'text-amber-accent' }, python: { icon: Terminal, color: 'text-blue-accent' }, website: { icon: Globe, color: 'text-accent' } };
  const t = typeMap[project.type] || typeMap.javascript;

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-panel/50 border border-border/50 hover:border-border hover:bg-panel transition-all duration-150 cursor-pointer"
      onClick={() => onOpen(project._id)}
    >
      <t.icon size={16} className={t.color} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{project.name}</div>
        {project.description && <div className="text-xs text-text-muted truncate">{project.description}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted hidden group-hover:flex items-center gap-1">
          <Clock size={11} /> {new Date(project.updatedAt).toLocaleDateString()}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(project); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <Trash2 size={13} />
        </button>
        <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState('javascript');
  const [createModal, setCreateModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project._id}`);
      setProjects(p => p.filter(x => x._id !== project.id));
      toast.success('Project deleted');
      fetchProjects();
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const filteredProjects = projects.filter(p => p.type === activeWorkspace);
  const ws = WORKSPACE_TYPES.find(w => w.id === activeWorkspace);

  return (
    <div className="h-full flex flex-col bg-void">
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Zap size={16} className="text-accent" />
          </div>
          <span className="font-display text-lg font-bold text-text-primary">DevMind</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">
            <span className="text-text-muted">Hello, </span>
            <span className="text-text-primary font-medium">{user?.username}</span>
          </span>
          <button onClick={logout} className="btn-ghost flex items-center gap-2 border border-border/50">
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Hero */}
          <div className="mb-10 animate-fade-in">
            <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Your Workspaces</h1>
            <p className="text-text-secondary">Select a workspace to manage projects, or create a new one.</p>
          </div>

          {/* Workspace type cards */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {WORKSPACE_TYPES.map((ws, i) => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                style={{ animationDelay: `${i * 80}ms` }}
                className={`relative text-left p-5 rounded-xl border transition-all duration-200 animate-slide-up ${ws.bg} ${ws.glow}
                  ${activeWorkspace === ws.id
                    ? `${ws.border} shadow-[0_0_25px_rgba(0,0,0,0.3)]`
                    : 'border-border/40 bg-surface/30 hover:bg-surface/60'
                  }`}
              >
                {activeWorkspace === ws.id && (
                  <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${ws.id === 'javascript' ? 'bg-amber-accent' : ws.id === 'python' ? 'bg-blue-accent' : 'bg-accent'} shadow-glow`} />
                )}
                <ws.icon size={24} className={`${ws.color} mb-3`} />
                <div className="font-display text-base font-semibold text-text-primary mb-1">{ws.label}</div>
                <div className="text-xs text-text-secondary leading-relaxed">{ws.desc}</div>
                <div className="mt-3 flex items-center gap-1.5">
                  {ws.exts.map(ext => (
                    <span key={ext} className={`text-xs font-mono px-1.5 py-0.5 rounded ${ws.bg} border ${ws.border} ${ws.color}`}>{ext}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Projects section */}
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ws.icon size={16} className={ws.color} />
                <h2 className="font-display text-lg font-semibold text-text-primary">{ws.label} Projects</h2>
                <span className="text-xs text-text-muted bg-panel border border-border rounded-full px-2 py-0.5">
                  {filteredProjects.length}
                </span>
              </div>
              <button
                onClick={() => setCreateModal(activeWorkspace)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={15} />
                New Project
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className={`border-2 border-dashed ${ws.border} rounded-xl p-10 text-center ${ws.bg}`}>
                <ws.icon size={32} className={`${ws.color} mx-auto mb-3 opacity-50`} />
                <p className="text-text-secondary font-medium mb-1">No {ws.label} projects yet</p>
                <p className="text-text-muted text-sm mb-4">Create your first project to get started</p>
                <button onClick={() => setCreateModal(activeWorkspace)} className="btn-primary inline-flex items-center gap-2">
                  <Plus size={14} /> Create Project
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    onOpen={(id) => navigate(`/editor/${id}`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {createModal && (
        <CreateProjectModal
          type={createModal}
          onClose={() => setCreateModal(null)}
          onCreated={(project) => {
            setCreateModal(null);
            navigate(`/editor/${project._id}`);
          }}
        />
      )}
    </div>
  );
}
