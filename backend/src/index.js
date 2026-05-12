import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import fileRoutes from './routes/files.js';
import chatRoutes from './routes/chat.js';
import versionRoutes from './routes/versions.js';
import executeRoutes from './routes/execute.js';
import shareRoutes from './routes/share.js';
import { errorHandler } from './middleware/errorHandler.js';
import rateLimit from 'express-rate-limit';
import User from './models/User.js';
import Project from './models/Project.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ── Socket.io ────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id username');
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

const projectPresence = new Map();
const USER_COLORS = ['#6EE7B7','#60A5FA','#F59E0B','#A78BFA','#F87171','#34D399','#FB923C'];

io.on('connection', (socket) => {
  const { user } = socket;
  let currentProject = null;

  socket.on('join_project', async ({ projectId }) => {
    try {
      const project = await Project.findOne({
        $or: [{ _id: projectId, owner: user._id }, { _id: projectId, isPublic: true }],
      }).select('_id');
      if (!project) return socket.emit('error', 'Access denied');

      currentProject = projectId;
      socket.join(projectId);

      if (!projectPresence.has(projectId)) projectPresence.set(projectId, new Map());
      const room = projectPresence.get(projectId);
      const colorIdx = room.size % USER_COLORS.length;
      room.set(socket.id, { userId: user._id.toString(), username: user.username, color: USER_COLORS[colorIdx] });

      io.to(projectId).emit('presence_update', Array.from(room.values()));
    } catch {
      socket.emit('error', 'Failed to join project');
    }
  });

  socket.on('code_change', ({ projectId, fileId, content }) => {
    socket.to(projectId).emit('code_change', { fileId, content, author: user.username });
  });

  socket.on('cursor_move', ({ projectId, fileId, position }) => {
    socket.to(projectId).emit('cursor_move', {
      fileId, position,
      author: { username: user.username, socketId: socket.id },
    });
  });

  socket.on('file_created', ({ projectId, file }) => {
    socket.to(projectId).emit('file_created', { file, author: user.username });
  });

  socket.on('file_deleted', ({ projectId, fileId }) => {
    socket.to(projectId).emit('file_deleted', { fileId, author: user.username });
  });

  const leaveProject = () => {
    if (!currentProject) return;
    const room = projectPresence.get(currentProject);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) projectPresence.delete(currentProject);
      else io.to(currentProject).emit('presence_update', Array.from(room.values()));
    }
  };

  socket.on('leave_project', leaveProject);
  socket.on('disconnect', leaveProject);
});

app.set('io', io);

// ── Express ──────────────────────────────────────────────────────
connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/share', shareRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;
