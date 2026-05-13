import React from 'react';

export default function PresenceAvatars({ users = [] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((u, i) => (
          <div
            key={u.userId + i}
            className="relative group"
            title={u.username}
          >
            <div
              className="w-7 h-7 rounded-full border-2 border-void flex items-center justify-center text-xs font-bold text-void select-none cursor-default"
              style={{ backgroundColor: u.color }}
            >
              {u.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-panel border border-border text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {u.username}
            </div>
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-7 h-7 rounded-full border-2 border-void bg-muted flex items-center justify-center text-xs font-bold text-text-secondary">
            +{users.length - 5}
          </div>
        )}
      </div>
      <span className="text-xs text-text-muted hidden sm:block">
        {users.length === 1 ? 'Just you' : `${users.length} editing`}
      </span>
    </div>
  );
}
