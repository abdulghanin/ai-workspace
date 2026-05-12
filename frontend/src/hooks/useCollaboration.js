import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

const getSocket = (token) => {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
};

/**
 * useCollaboration
 * Manages a Socket.io connection for a specific project room.
 *
 * @param {string} projectId
 * @param {string} token  — JWT from localStorage
 * @param {object} handlers — { onCodeChange, onCursorMove, onPresenceUpdate, onFileCreated, onFileDeleted }
 */
export function useCollaboration(projectId, token, handlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!projectId || !token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit('join_project', { projectId });
    };

    const onCodeChange = (data) => handlersRef.current.onCodeChange?.(data);
    const onCursorMove = (data) => handlersRef.current.onCursorMove?.(data);
    const onPresenceUpdate = (data) => handlersRef.current.onPresenceUpdate?.(data);
    const onFileCreated = (data) => handlersRef.current.onFileCreated?.(data);
    const onFileDeleted = (data) => handlersRef.current.onFileDeleted?.(data);

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('code_change', onCodeChange);
    socket.on('cursor_move', onCursorMove);
    socket.on('presence_update', onPresenceUpdate);
    socket.on('file_created', onFileCreated);
    socket.on('file_deleted', onFileDeleted);

    return () => {
      socket.emit('leave_project', { projectId });
      socket.off('connect', onConnect);
      socket.off('code_change', onCodeChange);
      socket.off('cursor_move', onCursorMove);
      socket.off('presence_update', onPresenceUpdate);
      socket.off('file_created', onFileCreated);
      socket.off('file_deleted', onFileDeleted);
    };
  }, [projectId, token]);

  const emitCodeChange = useCallback((fileId, content) => {
    socketRef.current?.emit('code_change', { projectId, fileId, content });
  }, [projectId]);

  const emitCursorMove = useCallback((fileId, position) => {
    socketRef.current?.emit('cursor_move', { projectId, fileId, position });
  }, [projectId]);

  const emitFileCreated = useCallback((file) => {
    socketRef.current?.emit('file_created', { projectId, file });
  }, [projectId]);

  const emitFileDeleted = useCallback((fileId) => {
    socketRef.current?.emit('file_deleted', { projectId, fileId });
  }, [projectId]);

  return { emitCodeChange, emitCursorMove, emitFileCreated, emitFileDeleted };
}
