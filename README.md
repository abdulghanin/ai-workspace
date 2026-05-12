# DevMind — AI Coding Workspace Platform
### Technical Assessment Delivery

---

## What Was Built

**DevMind** is a full-stack AI-powered coding workspace that lets users create, manage, and write code across three isolated environments — all with an integrated OpenAI assistant, real-time collaboration, sandboxed execution, version history, multi-tab editing, and public sharing.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│              React 18 + Vite + Tailwind CSS + Zustand           │
│                                                                  │
│   AuthPage → DashboardPage → EditorPage → SharedProjectPage     │
│                                                                  │
│   ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────────────────┐  │
│   │ FileTree │ │ TabBar  │ │ Monaco   │ │  ChatPanel (AI)   │  │
│   │ Sidebar  │ │ Multi   │ │ Editor   │ │  VersionPanel     │  │
│   │          │ │ -tab    │ │          │ │  ShareModal       │  │
│   └──────────┘ └─────────┘ └──────────┘ └───────────────────┘  │
│                                                                  │
│   ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│   │  ExecutionPanel      │ │  LivePreview (Website iframe)    │ │
│   │  (Terminal output)   │ │  Mobile / Desktop toggle         │ │
│   └──────────────────────┘ └──────────────────────────────────┘ │
│                                                                  │
│   ┌──────────────────────┐                                       │
│   │  PresenceAvatars     │  ← Real-time collaborator display    │
│   └──────────────────────┘                                       │
└─────────────┬──────────────────────────────────┬────────────────┘
              │ REST / HTTP                       │ WebSocket
┌─────────────▼───────────────────────────────────▼──────────────┐
│                     BACKEND (Node.js / Express)                  │
│                                                                  │
│  /auth   /projects   /files   /chat   /versions   /execute      │
│  /share                                                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Socket.io Server                            │   │
│  │  join_project • code_change • cursor_move               │   │
│  │  presence_update • file_created • file_deleted          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────┬────────────────────────┬────────────────────────────┘
           │                        │                    │
  ┌────────▼──────┐      ┌──────────▼──────┐   ┌────────▼────────┐
  │   MongoDB     │      │  OpenAI Chat    │   │  Piston API     │
  │  (Mongoose)   │      │  Completions    │   │  (free, OSS)    │
  │               │      │  AI assistant   │   │  JS + Python    │
  │  Users        │      │  with full      │   │  sandboxed      │
  │  Projects     │      │  project        │   │  execution      │
  │  Files        │      │  context        │   └─────────────────┘
  │  ChatHistory  │      └─────────────────┘
  │  Versions[]   │
  │  shareToken   │
  └───────────────┘
```

---

## The Three Workspaces

### 1. JavaScript Workspace
- Default files: `index.js`, `README.md`
- Monaco editor with full JS syntax highlighting, IntelliSense, bracket pair colorization
- Run code directly via the Terminal panel (powered by Piston)
- AI assistant understands imports, suggests Node.js patterns, debugs errors

### 2. Python Workspace
- Default files: `main.py`, `README.md`
- Python-aware syntax highlighting and auto-indent
- Run and see stdout/stderr in the Terminal with exit code reporting
- stdin input supported for interactive scripts

### 3. Website Builder
- Default files: `index.html`, `styles.css`, `script.js`
- Tailwind CSS loaded via CDN in the default template
- **Live Preview** pane renders the HTML/CSS/JS in a sandboxed iframe
- Mobile/desktop toggle in the preview toolbar
- AI can help build components, fix layout bugs, write Tailwind classes

---

## Feature Deep-Dives

### 1. Real-Time Collaboration (Socket.io)

**How it works:**

```
User A types in Monaco
      ↓
useCollaboration.emitCodeChange(fileId, content)
      ↓
socket.emit('code_change', { projectId, fileId, content })
      ↓  [Socket.io room broadcast — sender excluded]
User B's socket receives 'code_change'
      ↓
isRemoteChange.current = true  ← prevents echo loop
setEditorContent(content)       ← updates Monaco
toast("User A edited this file")
```

**Events implemented:**

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_project` | client → server | Enter a project room |
| `leave_project` | client → server | Exit a project room |
| `code_change` | broadcast | Sync file edits |
| `cursor_move` | broadcast | Share cursor position |
| `presence_update` | server → all | Who's in the room |
| `file_created` | broadcast | Sync new files |
| `file_deleted` | broadcast | Sync deletions |

**Presence avatars:** Each collaborator gets a unique color (7-color round-robin). Colored initials appear in the top bar. Hovering shows the full username tooltip.

**Authentication:** Socket.io middleware verifies the JWT token on every connection — unauthenticated sockets are rejected before joining any room.

---

### 2. Sandboxed Code Execution (Piston API)

**Why Piston?** It's a free, open-source, self-hostable code execution engine used by Replit and competitive programming platforms. No API key required.

**Flow:**

```
User clicks Run
      ↓
ExecutionPanel collects all project files (non-folder)
      ↓
POST /api/execute { language, files[], stdin }
      ↓
Backend calls https://emkc.org/api/v2/piston/execute
      ↓
Returns { stdout, stderr, exitCode, elapsed }
      ↓
Terminal renders output with color coding
  • stdout   → white
  • stderr   → red with [stderr] prefix
  • system   → muted italic
  • success  → green with exit code + timing
```

**Safety:**
- All execution happens on Piston's remote sandboxed infrastructure
- 5-second run timeout, 10-second compile timeout enforced
- Backend acts as proxy — the client never calls Piston directly
- Graceful degradation if Piston is unreachable (503 with user-friendly message)

**stdin support:** Users can expand a stdin input field to provide input to interactive programs before clicking Run.

---

### 3. Version History

**Data model:**

```javascript
// Embedded in Project document
versions: [{
  message: "Added user auth",
  label: "",
  files: [ /* deep copy of all files at snapshot time */ ],
  author: ObjectId,
  createdAt: Date,
}]
// Max 50 versions kept (oldest trimmed automatically)
```

**Features:**
- **Save version** — creates a full snapshot of all project files with a commit message
- **Timeline view** — newest-first list with relative timestamps ("2h ago"), file count, "latest" badge
- **Expand version** — click any version to see all files + character counts
- **Restore** — auto-saves current state first (so you never lose work), then replaces files
- **Delete** — remove individual version snapshots

**Safe restore flow:**
```
User clicks Restore on version V
      ↓
Auto-save current files as "Auto-save before restore to V"
      ↓
Replace project.files with V.files snapshot
      ↓
Re-render editor with restored content
      ↓
Refresh version list (new auto-save appears at top)
```

---

### 4. Multi-Tab Editor

**State management:**

```javascript
const [openTabs, setOpenTabs] = useState([]);    // array of file objects
const [tabUnsaved, setTabUnsaved] = useState({}); // { fileId: boolean }
```

**Tab behaviors:**
- Click file in tree → opens in a new tab (no duplicates)
- Click tab → switches to that file, restores its content
- Close tab (×) → switches to the last remaining tab automatically
- **Unsaved indicator:** amber dot on tab when content differs from last save
- Dot → × on hover, so you can close even with unsaved changes
- Remote edits from collaborators update the correct tab's content silently

**Tab bar design:**
- Active tab: `border-t-2 border-t-accent` (green top border), elevated background
- Inactive tab: transparent top border, dimmed text
- Overflow: horizontal scroll with hidden scrollbar (`scrollbar: none`)

---

### 5. Project Sharing & Public URLs

**Share flow:**

```
Owner opens Share modal
      ↓
Toggle "Public" ON
      ↓
POST /api/share/:id/enable
      ↓
Server generates 32-char hex token, sets isPublic=true
      ↓
Returns { shareUrl: "http://localhost:5173/shared/<token>" }
      ↓
URL displayed with one-click copy button
```

**Public project page (`/shared/:token`):**
- No authentication required — fully public read-only view
- Monaco editor in `readOnly: true` mode
- File tree sidebar with full folder navigation
- "Fork on DevMind →" CTA button for visitors to sign up
- Graceful 404 if token is invalid or sharing was disabled

**Security:**
- Each share has an independent token — revoking disables access immediately
- "New link" regenerates the token, invalidating the old URL
- Public route only exposes: `name`, `type`, `files`, `owner.username` — chat history and version history are excluded from the query

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

## Complete Requirements Checklist

| Requirement | Status |
|-------------|--------|
| User auth (register / login / session) | ✅ |
| JavaScript Workspace | ✅ |
| Python Workspace | ✅ |
| Website Builder (HTML + CSS + JS + Tailwind) | ✅ |
| Multiple files per project | ✅ |
| File create / edit / delete | ✅ |
| Nested folder structure | ✅ |
| Persist files in MongoDB | ✅ |
| AI chat per project | ✅ |
| Chat history per project | ✅ |
| AI understands all project files | ✅ |
| Node.js + Express backend | ✅ |
| MongoDB + Mongoose | ✅ |
| React frontend | ✅ |
| Card-based workspace dashboard | ✅ |
| Live preview (Website Builder) | ✅ |
| Tailwind CSS UI | ✅ |
| Docker + docker-compose | ✅ |
| **Real-time collaboration (Socket.io)** | ✅ **Bonus** |
| **Sandboxed code execution (Piston)** | ✅ **Bonus** |
| **Version history with restore** | ✅ **Bonus** |
| **Multi-tab editor** | ✅ **Bonus** |
| **Project sharing + public URLs** | ✅ **Bonus** |

---

## MongoDB Schema Summary

```
User
  _id, username, email, password (bcrypt), createdAt

Project
  _id, name, description, type, owner → User
  isPublic, shareToken
  files[] → {
    _id, name, path, content, language,
    isFolder, parentPath, createdAt, updatedAt
  }
  chatHistory[] → { role, content, timestamp }
  versions[] → {
    _id, message, label, author → User,
    files[] (deep snapshot), createdAt
  }
  lastOpenedFile, createdAt, updatedAt
```

Indexes: `{ owner, type }`, `{ owner, updatedAt }`, `{ shareToken }` (sparse)

---

## Security Overview

| Concern | Solution |
|---------|----------|
| Password storage | bcrypt (12 salt rounds) |
| API authentication | JWT (7-day expiry), Bearer token |
| Data isolation | Every query includes `owner: req.user._id` |
| Rate limiting | 300 req / 15 min per IP |
| Code execution | Piston remote sandbox, 5s timeout |
| Share access | Cryptographic 32-char hex token |
| Public data scope | Chat history + versions excluded from public API |
| WebSocket auth | JWT verified in Socket.io middleware |
| Preview XSS | `sandbox="allow-scripts allow-forms"` on iframe |
| API key exposure | OpenAI/Anthropic key stays server-side only |

---

## How to Run

```bash
# 1. Backend
cd backend
cp .env.example .env
# Edit .env — add OPENAI_API_KEY (or ANTHROPIC_API_KEY fallback) and a long JWT_SECRET
npm install && npm run dev       # → http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install && npm run dev       # → http://localhost:5173

# Or: Docker Compose
docker-compose up --build
```

**Required:** `OPENAI_API_KEY` in `backend/.env` (or set `ANTHROPIC_API_KEY` as a fallback)

---

## If I Had More Time

1. **Cursor sharing** — render remote cursors in Monaco using `editor.deltaDecorations()`; the `cursor_move` socket event is already emitted, just needs the UI decoration layer
2. **Conflict resolution** — implement Operational Transform or CRDT (e.g. Yjs) for true concurrent editing without last-write-wins
3. **Self-hosted Piston** — deploy the open-source Piston server for guaranteed availability and zero cold-start latency
4. **Project forking** — "Fork on DevMind" button on shared projects that deep-copies all files into a new project for the viewer
5. **Terminal WebSocket** — xterm.js + a pty WebSocket bridge for a real interactive shell experience

---

*Built with React, Node.js, MongoDB, Socket.io, Monaco Editor, Piston API, and the OpenAI Chat Completions API.*
