import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Trash2,
  FilePlus,
  FolderPlus,
  FileCode,
  FileText,
  Globe,
  Terminal
} from 'lucide-react';

import toast from 'react-hot-toast';
import api from '../../utils/api.js';

const buildPath = (parentPath, name) => {
  if (!parentPath || parentPath === '/') {
    return `/${name}`;
  }

  return `${parentPath}/${name}`;
};

const FileIcon = ({ name, isFolder, open }) => {
  if (isFolder) {
    return open
      ? <FolderOpen size={14} className="text-amber-accent" />
      : <Folder size={14} className="text-amber-accent/70" />;
  }

  const ext = name.split('.').pop().toLowerCase();

  const iconMap = {
    js: <FileCode size={14} className="text-amber-accent" />,
    jsx: <FileCode size={14} className="text-blue-accent" />,
    ts: <FileCode size={14} className="text-blue-accent" />,
    tsx: <FileCode size={14} className="text-blue-accent" />,
    py: <Terminal size={14} className="text-green-400" />,
    html: <Globe size={14} className="text-orange-400" />,
    css: <FileCode size={14} className="text-purple-400" />,
    json: <FileCode size={14} className="text-yellow-400" />,
    md: <FileText size={14} className="text-text-secondary" />,
  };

  return iconMap[ext] || (
    <File size={14} className="text-text-muted" />
  );
};

function FileTreeNode({
  file,
  files,
  depth = 0,
  activeFileId,
  onSelect,
  onDelete,
  onCreate
}) {
  const [open, setOpen] = useState(depth === 0);

  const children = files.filter(
    f => f.parentPath === file.path
  );

  const handleClick = () => {
    if (file.isFolder) {
      setOpen(prev => !prev);
    } else {
      onSelect(file);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`group flex items-center gap-2 py-1.5 pr-2 cursor-pointer hover:bg-panel/60 transition-all ${
          activeFileId === file._id ? 'bg-panel' : ''
        }`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        {file.isFolder ? (
          open ? (
            <ChevronDown size={12} className="text-text-muted" />
          ) : (
            <ChevronRight size={12} className="text-text-muted" />
          )
        ) : (
          <div className="w-3" />
        )}

        <FileIcon
          name={file.name}
          isFolder={file.isFolder}
          open={open}
        />

        <span className="flex-1 truncate text-xs text-text-primary">
          {file.name}
        </span>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          {file.isFolder && (
            <>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onCreate(file.path, false);
                }}
                className="p-1 rounded hover:bg-panel"
              >
                <FilePlus size={11} />
              </button>

              <button
                onClick={e => {
                  e.stopPropagation();
                  onCreate(file.path, true);
                }}
                className="p-1 rounded hover:bg-panel"
              >
                <FolderPlus size={11} />
              </button>
            </>
          )}

          <button
            onClick={e => {
              e.stopPropagation();
              onDelete(file);
            }}
            className="p-1 rounded hover:bg-panel text-red-400"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {file.isFolder && open && children.map(child => (
        <FileTreeNode
          key={child._id}
          file={child}
          files={files}
          depth={depth + 1}
          activeFileId={activeFileId}
          onSelect={onSelect}
          onDelete={onDelete}
          onCreate={onCreate}
        />
      ))}
    </div>
  );
}

export default function FileTree({
  projectId,
  files,
  activeFile,
  onFileSelect,
  onFilesChange
}) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [parentPath, setParentPath] = useState('/');
  const [isFolder, setIsFolder] = useState(false);

  const rootFiles = files.filter(
    f => f.parentPath === '/' || !f.parentPath
  );

  const openCreateInput = (
    targetParent = '/',
    folder = false
  ) => {
    setParentPath(targetParent);
    setIsFolder(folder);
    setShowInput(true);
    setNewName('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!newName.trim()) return;

    const cleanName = newName.trim();

    const newFile = {
      name: cleanName,
      path: buildPath(parentPath, cleanName),
      parentPath,
      isFolder,
      content: isFolder ? '' : '',
    };

    try {
      const res = await api.post(
        `/files/${projectId}`,
        newFile
      );

      onFilesChange([...files, res.data.file]);

      if (!isFolder) {
        onFileSelect(res.data.file);
      }

      setShowInput(false);
      setNewName('');

      toast.success(
        isFolder
          ? 'Folder created'
          : 'File created'
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'Creation failed'
      );
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Delete "${file.name}" ?`
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/files/${projectId}/${file._id}`
      );

      const updated = files.filter(f => {
        if (f._id === file._id) return false;

        if (
          f.path.startsWith(file.path + '/')
        ) {
          return false;
        }

        return true;
      });

      onFilesChange(updated);

      if (activeFile?._id === file._id) {
        const nextFile = updated.find(
          f => !f.isFolder
        );

        onFileSelect(nextFile || null);
      }

      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Files
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => openCreateInput('/', false)}
            className="p-1.5 rounded hover:bg-panel"
            title="New file"
          >
            <FilePlus size={13} />
          </button>

          <button
            onClick={() => openCreateInput('/', true)}
            className="p-1.5 rounded hover:bg-panel"
            title="New folder"
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootFiles.map(file => (
          <FileTreeNode
            key={file._id}
            file={file}
            files={files}
            activeFileId={activeFile?._id}
            onSelect={onFileSelect}
            onDelete={handleDelete}
            onCreate={openCreateInput}
          />
        ))}

        {showInput && (
          <form
            onSubmit={handleCreate}
            className="px-3 py-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={() => {
                if (!newName.trim()) {
                  setShowInput(false);
                }
              }}
              placeholder={
                isFolder
                  ? 'folder-name'
                  : 'filename.js'
              }
              className="w-full px-2 py-1 rounded border border-accent/30 bg-panel text-xs outline-none"
            />
          </form>
        )}
      </div>
    </div>
  );
}