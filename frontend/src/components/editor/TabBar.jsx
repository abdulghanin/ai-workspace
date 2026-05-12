import React from 'react';
import { X, FileCode, FileText, Globe, Terminal } from 'lucide-react';

const FILE_ICONS = {
  js: <FileCode size={11} className="text-amber-accent flex-shrink-0" />,
  py: <Terminal size={11} className="text-blue-accent flex-shrink-0" />,
  html: <Globe size={11} className="text-accent flex-shrink-0" />,
  css: <FileCode size={11} className="text-purple-400 flex-shrink-0" />,
};

const getIcon = (name) => {
  const ext = name?.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || <FileText size={11} className="text-text-muted flex-shrink-0" />;
};

export default function TabBar({ tabs, activeFileId, onSelect, onClose }) {
  if (!tabs || tabs.length === 0) return null;

  return (
    <div className="flex items-end overflow-x-auto bg-void border-b border-border/50 flex-shrink-0"
         style={{ scrollbarWidth: 'none' }}>
      {tabs.map((tab) => {
        const isActive = tab._id === activeFileId;
        return (
          <div
            key={tab._id}
            onClick={() => onSelect(tab)}
            className={`group flex items-center gap-1.5 px-3 py-2 border-r border-border/40 cursor-pointer flex-shrink-0 max-w-[160px] transition-colors relative ${
              isActive
                ? 'bg-surface text-text-primary border-t-2 border-t-accent'
                : 'bg-void text-text-muted hover:bg-surface/50 hover:text-text-secondary border-t-2 border-t-transparent'
            }`}
          >
            {getIcon(tab.name)}
            <span className="text-xs font-mono truncate">{tab.name}</span>
            {tab.unsaved && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-accent flex-shrink-0 group-hover:hidden" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab._id); }}
              className={`flex-shrink-0 p-0.5 rounded hover:bg-panel transition-colors ${
                tab.unsaved ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'
              } items-center justify-center`}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
