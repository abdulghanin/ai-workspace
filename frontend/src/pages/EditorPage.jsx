import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useAuthStore } from '../context/authStore.js';
import { useCollaboration } from '../hooks/useCollaboration.js';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import FileTree from '../components/editor/FileTree.jsx';
import ChatPanel from '../components/chat/ChatPanel.jsx';
import LivePreview from '../components/editor/LivePreview.jsx';
import TabBar from '../components/editor/TabBar.jsx';
import ExecutionPanel from '../components/editor/ExecutionPanel.jsx';
import VersionPanel from '../components/editor/VersionPanel.jsx';
import ShareModal from '../components/editor/ShareModal.jsx';
import PresenceAvatars from '../components/editor/PresenceAvatars.jsx';
import {
  ArrowLeft, Save, MessageSquare, Eye, Code2, Globe, Terminal,
  Check, PanelLeftClose, PanelLeftOpen, Play, GitBranch, Share2,
  Edit, X
} from 'lucide-react';

const LANG_MAP = {
  javascript: 'javascript', python: 'python', html: 'html',
  css: 'css', json: 'json', markdown: 'markdown', text: 'plaintext',
};

const TYPE_INFO = {
  javascript: { label: 'JavaScript', icon: Code2, color: 'text-amber-accent' },
  python: { label: 'Python', icon: Terminal, color: 'text-blue-accent' },
  website: { label: 'Website Builder', icon: Globe, color: 'text-accent' },
};

export default function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [debouncedProjectName, setDebouncedProjectName] = useState('');
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameStatus, setRenameStatus] = useState('idle');

  // ── Multi-tab state ──
  const [openTabs, setOpenTabs] = useState([]);    // array of file objects
  const [tabUnsaved, setTabUnsaved] = useState({}); // fileId -> boolean

  // ── Panel visibility ──
  const [showSidebar, setShowSidebar] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // ── Collaboration ──
  const [collaborators, setCollaborators] = useState([]);
  const [remoteChanges, setRemoteChanges] = useState(null); // { fileId, content }

  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);
  const isRemoteChange = useRef(false);

  // ── Socket.io collaboration ──
  const { emitCodeChange, emitCursorMove, emitFileCreated, emitFileDeleted } =
    useCollaboration(projectId, token, {
      onPresenceUpdate: (users) => setCollaborators(users),
      onCodeChange: ({ fileId, content, author }) => {
        if (fileId === activeFile?._id) {
          isRemoteChange.current = true;
          setRemoteChanges({ fileId, content });
          toast(`${author} edited this file`, { icon: '✏️', duration: 2000 });
        }
        // Update file content in array too
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, content } : f));
      },
      onFileCreated: ({ file, author }) => {
        setFiles(prev => [...prev, file]);
        toast(`${author} created ${file.name}`, { icon: '📄', duration: 2000 });
      },
      onFileDeleted: ({ fileId, author }) => {
        setFiles(prev => prev.filter(f => f._id !== fileId));
        setOpenTabs(prev => prev.filter(t => t._id !== fileId));
        toast(`${author} deleted a file`, { icon: '🗑️', duration: 2000 });
      },
    });

  // Apply remote changes to editor
  useEffect(() => {
    if (!remoteChanges) return;
    if (remoteChanges.fileId === activeFile?._id) {
      setEditorContent(remoteChanges.content);
    }
    setRemoteChanges(null);
  }, [remoteChanges]);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (project?.name && !isRenamingProject) {
      setProjectNameDraft(project.name);
      setDebouncedProjectName(project.name);
    }
  }, [project?.name, isRenamingProject]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProjectName(projectNameDraft), 180);
    return () => clearTimeout(timer);
  }, [projectNameDraft]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      const proj = res.data.project;
      setProject(proj);
      setFiles(proj.files || []);
      setChatHistory(proj.chatHistory || []);

      const firstFile = proj.files?.find(f => !f.isFolder && (
        proj.lastOpenedFile ? f.path === proj.lastOpenedFile : true
      ));
      if (firstFile) openFileInTab(firstFile, proj.files);
      if (proj.type === 'website') setShowPreview(true);
    } catch {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // ── Tab management ──
  const openFileInTab = (file, allFiles) => {
    if (file?.isFolder) return;
    setActiveFile(file);
    setEditorContent(file?.content || '');
    setSaved(true);
    setOpenTabs(prev => {
      if (prev.find(t => t._id === file._id)) return prev;
      return [...prev, { ...file, unsaved: false }];
    });
  };

  const handleFileSelect = (file) => openFileInTab(file, files);

  const handleTabClose = (fileId) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t._id !== fileId);
      if (activeFile?._id === fileId) {
        const fallback = next[next.length - 1];
        if (fallback) {
          const full = files.find(f => f._id === fallback._id) || fallback;
          setActiveFile(full);
          setEditorContent(full.content || '');
        } else {
          setActiveFile(null);
          setEditorContent('');
        }
      }
      return next;
    });
    setTabUnsaved(prev => { const n = { ...prev }; delete n[fileId]; return n; });
  };

  const handleTabSelect = (tab) => {
    const full = files.find(f => f._id === tab._id) || tab;
    setActiveFile(full);
    setEditorContent(full.content || '');
    setSaved(!tabUnsaved[tab._id]);
  };

  // ── Editor change ──
  const handleEditorChange = useCallback((value) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    const v = value || '';
    setEditorContent(v);
    setSaved(false);
    if (activeFile) {
      setTabUnsaved(prev => ({ ...prev, [activeFile._id]: true }));
      setOpenTabs(prev => prev.map(t => t._id === activeFile._id ? { ...t, unsaved: true } : t));
      // Emit to collaborators
      emitCodeChange(activeFile._id, v);
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => handleSave(v), 2000);
  }, [activeFile, emitCodeChange]);

  const handleSave = async (content) => {
    if (!activeFile) return;
    const toSave = content ?? editorContent;
    setSaving(true);
    try {
      await api.put(`/files/${projectId}/${activeFile._id}`, { content: toSave });
      setFiles(prev => prev.map(f => f._id === activeFile._id ? { ...f, content: toSave } : f));
      setActiveFile(prev => ({ ...prev, content: toSave }));
      setTabUnsaved(prev => ({ ...prev, [activeFile._id]: false }));
      setOpenTabs(prev => prev.map(t => t._id === activeFile._id ? { ...t, unsaved: false } : t));
      setSaved(true);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+S
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      handleSave();
    }
  }, [editorContent, activeFile]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── File tree events (broadcast to collaborators) ──
  const handleFilesChange = (newFiles) => {
    setFiles(newFiles);
  };

  const handleVersionRestore = (restoredFiles) => {
    setFiles(restoredFiles);
    const current = restoredFiles.find(f => f._id === activeFile?._id);
    if (current) {
      setActiveFile(current);
      setEditorContent(current.content || '');
    }
    toast.success('Project restored to selected version');
  };

  const startProjectRename = () => {
    setProjectNameDraft(project?.name || '');
    setDebouncedProjectName(project?.name || '');
    setRenameStatus('idle');
    setIsRenamingProject(true);
  };

  const cancelProjectRename = () => {
    setProjectNameDraft(project?.name || '');
    setDebouncedProjectName(project?.name || '');
    setRenameStatus('idle');
    setIsRenamingProject(false);
  };

  const handleProjectRenameSave = async (e) => {
    e?.preventDefault();
    const trimmedName = projectNameDraft.trim();
    if (!trimmedName) {
      setRenameStatus('error');
      return;
    }
    if (trimmedName === project?.name) {
      cancelProjectRename();
      return;
    }

    const previousProject = project;
    setRenamingProject(true);
    setRenameStatus('saving');
    setProject(prev => ({ ...prev, name: trimmedName }));

    try {
      const res = await api.put(`/projects/${projectId}`, {
        name: trimmedName,
        description: previousProject?.description || '',
      });
      setProject(prev => ({ ...prev, ...res.data.project }));
      setRenameStatus('saved');
      setIsRenamingProject(false);
      setTimeout(() => setRenameStatus('idle'), 1200);
    } catch {
      setProject(previousProject);
      setRenameStatus('error');
      setIsRenamingProject(true);
    } finally {
      setRenamingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-text-secondary text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const typeInfo = TYPE_INFO[project?.type] || TYPE_INFO.javascript;
  const editorLang = LANG_MAP[activeFile?.language] || 'plaintext';
  const isWebsite = project?.type === 'website';
  const filesWithContent = files.map(f =>
    f._id === activeFile?._id ? { ...f, content: editorContent } : f
  );

  // Tabs with unsaved state merged in
  const displayTabs = openTabs.map(t => ({ ...t, unsaved: !!tabUnsaved[t._id] }));

  return (
    <div className="h-full flex flex-col bg-void overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <button onClick={() => navigate('/dashboard')}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-panel transition-all">
          <ArrowLeft size={15} />
        </button>

        <div className="flex items-center gap-2 min-w-0 group/title">
          <div className="w-6 h-6 rounded-md bg-panel border border-border flex items-center justify-center flex-shrink-0">
            <typeInfo.icon size={13} className={typeInfo.color} />
          </div>
          {isRenamingProject ? (
            <form onSubmit={handleProjectRenameSave} className="flex items-center gap-1 min-w-0">
              <input
                autoFocus
                className={`h-7 w-44 max-w-[34vw] rounded-md border bg-panel px-2 text-sm font-semibold text-text-primary outline-none transition-colors ${
                  renameStatus === 'error'
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-border focus:border-accent/70'
                }`}
                value={projectNameDraft}
                onChange={e => {
                  setProjectNameDraft(e.target.value);
                  if (renameStatus === 'error') setRenameStatus('idle');
                }}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Escape') cancelProjectRename();
                }}
                maxLength={100}
              />
              <button
                type="submit"
                disabled={renamingProject || !debouncedProjectName.trim()}
                className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Save project name"
              >
                {renamingProject ? <div className="w-3.5 h-3.5 rounded-full border border-accent border-t-transparent animate-spin" /> : <Check size={14} />}
              </button>
              <button
                type="button"
                onClick={cancelProjectRename}
                disabled={renamingProject}
                className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-panel disabled:opacity-50 transition-all"
                title="Cancel rename"
              >
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={startProjectRename}
                className="text-sm font-semibold text-text-primary truncate max-w-[160px] hover:text-accent transition-colors text-left"
                title="Rename project"
              >
                {project?.name}
              </button>
              <button
                onClick={startProjectRename}
                className="opacity-0 group-hover/title:opacity-100 p-1 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                title="Rename project"
              >
                <Edit size={12} />
              </button>
              {renameStatus === 'saved' && <Check size={12} className="text-accent" />}
              {renameStatus === 'error' && <span className="text-[11px] text-red-400">Not saved</span>}
            </div>
          )}
        </div>

        {/* Presence avatars */}
        <div className="hidden sm:flex items-center ml-1">
          <PresenceAvatars users={collaborators} />
        </div>

        <div className="flex-1" />

        {/* Right toolbar buttons */}
        <div className="flex items-center gap-1">
          {/* Sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-md transition-all ${showSidebar ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="Files (⌘B)"
          >
            {showSidebar ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          {/* Terminal toggle */}
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-1.5 rounded-md transition-all ${showTerminal ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="Terminal"
          >
            <Play size={14} />
          </button>

          {/* Preview toggle (website only) */}
          {isWebsite && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-1.5 rounded-md transition-all ${showPreview ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
              title="Live Preview"
            >
              <Eye size={14} />
            </button>
          )}

          {/* Version history */}
          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`p-1.5 rounded-md transition-all ${showVersions ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="Version History"
          >
            <GitBranch size={14} />
          </button>

          {/* Share */}
          <button
            onClick={() => setShowShare(true)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-panel transition-all"
            title="Share Project"
          >
            <Share2 size={14} />
          </button>

          {/* AI Chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-1.5 rounded-md transition-all ${showChat ? 'text-blue-accent bg-blue-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="AI Assistant"
          >
            <MessageSquare size={14} />
          </button>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Save button */}
          <button
            onClick={() => handleSave()}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              saved
                ? 'text-accent/40 border border-border/40'
                : 'text-void bg-accent hover:bg-accent/90'
            }`}
          >
            {saving
              ? <div className="w-3 h-3 rounded-full border border-void border-t-transparent animate-spin" />
              : saved
              ? <><Check size={11} /> Saved</>
              : <><Save size={11} /> Save</>}
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* File sidebar */}
        {showSidebar && (
          <div className="w-52 flex-shrink-0 border-r border-border/50 bg-surface/30 flex flex-col overflow-hidden">
            <FileTree
              projectId={projectId}
              files={files}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFilesChange={handleFilesChange}
              onFileCreated={emitFileCreated}
              onFileDeleted={emitFileDeleted}
            />
          </div>
        )}

        {/* Center: editor + preview + terminal */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <TabBar
            tabs={displayTabs}
            activeFileId={activeFile?._id}
            onSelect={handleTabSelect}
            onClose={handleTabClose}
          />

          {/* Editor row */}
          <div className={`flex flex-1 overflow-hidden ${showPreview && isWebsite ? 'flex-row' : ''}`}>
            {/* Monaco */}
            <div className={`flex flex-col overflow-hidden ${showPreview && isWebsite ? 'w-1/2' : 'flex-1'}`}>
              {activeFile ? (
                <Editor
                  height="100%"
                  language={editorLang}
                  value={editorContent}
                  onChange={handleEditorChange}
                  onMount={(editor) => { editorRef.current = editor; }}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontLigatures: true,
                    lineHeight: 1.7,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true },
                    renderLineHighlight: 'gutter',
                    scrollbar: { vertical: 'auto', horizontal: 'auto' },
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <typeInfo.icon size={36} className={`${typeInfo.color} mx-auto mb-3 opacity-20`} />
                    <p className="text-text-muted text-sm">Select a file to start editing</p>
                    <p className="text-text-muted text-xs mt-1 opacity-60">or create one from the file tree</p>
                  </div>
                </div>
              )}
            </div>

            {/* Live preview */}
            {showPreview && isWebsite && (
              <div className="w-1/2 border-l border-border/50 overflow-hidden">
                <LivePreview files={filesWithContent} />
              </div>
            )}
          </div>

          {/* Execution terminal */}
          <ExecutionPanel
            files={filesWithContent}
            projectType={project?.type}
            visible={showTerminal}
            onToggle={() => setShowTerminal(false)}
          />
        </div>

        {/* Right panels: version history OR chat */}
        {(showVersions || showChat) && (
          <div className="w-80 flex-shrink-0 border-l border-border/50 flex flex-col overflow-hidden">
            {showVersions ? (
              <VersionPanel
                projectId={projectId}
                onRestore={handleVersionRestore}
                onClose={() => setShowVersions(false)}
              />
            ) : showChat ? (
              <ChatPanel
                projectId={projectId}
                chatHistory={chatHistory}
                onHistoryUpdate={setChatHistory}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && (
        <ShareModal
          projectId={projectId}
          projectName={project?.name}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
