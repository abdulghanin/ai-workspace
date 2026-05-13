# DevMind — AI Coding Workspace Platform

AI-powered collaborative coding workspace with real-time editing, local sandboxed execution, AI assistance, live previews, version history, and project sharing.



---

# Features

## AI Coding Assistant
- Integrated AI chat per project
- AI understands full project context
- Generate, debug, and refactor code
- Persistent chat history

---

## Multi-Workspace Support

### JavaScript Workspace
- Monaco Editor support
- Multi-file projects
- Local sandboxed execution using vm2

### Python Workspace
- Python execution support
- stdin support
- stdout / stderr terminal output
- Safety shim protection layer

### Website Builder
- HTML/CSS/JS workspace
- Live preview iframe
- Tailwind CSS support
- Mobile/Desktop preview mode

---

## Real-Time Collaboration
- Live collaborative editing with Socket.io
- Presence indicators
- Multi-user project rooms
- Real-time file synchronization

---

## Local Sandboxed Code Execution

DevMind includes a custom local execution engine built directly into the backend.

### JavaScript Execution
Uses:
- vm2 NodeVM sandbox
- console interception
- builtin module restrictions
- execution timeout protection

### Python Execution
Uses:
- child_process subprocess execution
- temporary isolated files
- custom Python safety shim
- blocked dangerous imports
- execution timeout protection

---

# Security Features

## JavaScript Sandbox Protection

Blocked modules:
- fs
- child_process
- net
- http
- os

Execution timeout:
- 5 seconds maximum

---

## Python Safety Protection

Blocked:
- subprocess
- socket
- multiprocessing
- threading
- ctypes
- os.system
- os.execv
- os.fork

Execution timeout:
- 5 seconds maximum

---

# Tech Stack

## Frontend
- React 18
- Vite
- Tailwind CSS
- Zustand
- Monaco Editor
- Socket.io Client

## Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.io
- JWT Authentication
- vm2
- child_process

---

# Architecture

```text
Frontend (React + Monaco + Socket.io)
        │
        ▼
Backend API (Node.js / Express)
        │
 ┌──────┼─────────────────────────┐
 ▼      ▼                         ▼
MongoDB AI Provider      Local Execution Engine
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              vm2 Sandbox         Python Subprocess
```

---


---

# How Code Execution Works

## JavaScript Flow

```text
User clicks Run
        ↓
Backend receives project files
        ↓
vm2 NodeVM sandbox created
        ↓
Restricted require() environment
        ↓
console.log intercepted
        ↓
stdout / stderr captured
        ↓
Result returned to frontend
```

---

## Python Flow

```text
User clicks Run
        ↓
Backend creates temporary file
        ↓
Safety shim injected
        ↓
Python subprocess launched
        ↓
stdout / stderr captured
        ↓
Temporary files deleted
        ↓
Result returned to frontend
```

---

# Supported Languages

| Language | Runtime |
|---|---|
| JavaScript | vm2 NodeVM |
| Python | Local Python subprocess |

---

## API Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT |
| GET | `/api/auth/me` | ✓ | Verify session |
| GET | `/api/projects` | ✓ | List projects |
| POST | `/api/projects` | ✓ | Create project |
| GET | `/api/projects/:id` | ✓ | Full project load |
| PUT | `/api/projects/:id` | ✓ | Update metadata |
| DELETE | `/api/projects/:id` | ✓ | Delete project |
| GET | `/api/files/:projectId` | ✓ | List files |
| POST | `/api/files/:projectId` | ✓ | Create file/folder |
| PUT | `/api/files/:pid/:fid` | ✓ | Save content |
| DELETE | `/api/files/:pid/:fid` | ✓ | Delete file |
| GET | `/api/chat/:projectId` | ✓ | Get chat history |
| POST | `/api/chat/:projectId` | ✓ | AI message |
| DELETE | `/api/chat/:projectId` | ✓ | Clear chat |
| GET | `/api/versions/:projectId` | ✓ | List versions |
| POST | `/api/versions/:projectId` | ✓ | Save snapshot |
| GET | `/api/versions/:pid/:vid` | ✓ | Get version detail |
| POST | `/api/versions/:pid/:vid/restore` | ✓ | Restore version |
| DELETE | `/api/versions/:pid/:vid` | ✓ | Delete version |
| POST | `/api/execute` | ✓ | Run code (Piston) |
| GET | `/api/execute/runtimes` | — | List runtimes |
| POST | `/api/share/:id/enable` | ✓ | Make public |
| POST | `/api/share/:id/disable` | ✓ | Revoke access |
| POST | `/api/share/:id/regenerate` | ✓ | New share token |
| GET | `/api/share/:id/status` | ✓ | Share status |
| GET | `/api/share/view/:token` | — | Public view |


---

# Real-Time Collaboration Events

| Event | Purpose |
|---|---|
| join_project | Join project room |
| leave_project | Leave room |
| code_change | Sync editor changes |
| cursor_move | Share cursor position |
| presence_update | Active collaborators |
| file_created | Sync new files |
| file_deleted | Sync deleted files |

---

# MongoDB Schema Overview

```text
User
 ├── username
 ├── email
 ├── password
 └── createdAt

Project
 ├── name
 ├── description
 ├── type
 ├── owner
 ├── files[]
 ├── chatHistory[]
 ├── versions[]
 ├── shareToken
 └── isPublic
```

---

# Environment Variables

## Backend `.env`

```env
PORT=5000

MONGO_URI=mongodb://localhost:27017/devmind

JWT_SECRET=your_secret_key

OPENAI_API_KEY=your_openai_key
```

---

# Running the Project

## Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

# Docker Compose

```bash
docker-compose up --build
```

---

# Version History

- Save project snapshots
- Restore previous versions
- Auto-save before restore
- Timeline-based history

---

# Project Sharing

- Public share URLs
- Read-only public projects
- Share token regeneration
- Secure access control

---

# Editor Features

- Multi-tab editing
- Monaco syntax highlighting
- IntelliSense
- Unsaved change indicators
- Live synchronization

---

# Security Overview

| Concern | Solution |
|---|---|
| Password storage | bcrypt |
| Authentication | JWT |
| Sandbox protection | vm2 + restricted builtins |
| Python protection | safety shim |
| Execution timeout | 5-second limit |
| WebSocket auth | JWT middleware |
| Data isolation | owner-based queries |

---

# Current Limitations

This project uses a lightweight local execution sandbox suitable for:
- MVPs
- portfolio projects
- local development
- educational coding platforms

Not recommended for:
- public internet code execution
- multi-tenant SaaS production systems
- untrusted enterprise workloads

---

# Future Improvements

- Docker-based isolated execution
- Judge0 integration
- Kubernetes sandbox workers
- CRDT collaborative editing
- Remote cursor rendering
- Interactive terminal with xterm.js
- Project forking
- AI autonomous coding agents

---

# Built With

- React
- Node.js
- MongoDB
- Socket.io
- Monaco Editor
- vm2
- Python subprocess execution
- OpenAI API