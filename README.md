# Sightline

A chat-based tool for media planners to build audience segments using plain English. Describe who you want to reach, and the AI recommends targeting signals with an estimated reach.

---

## What It Does

1. A planner types something like *"fitness enthusiasts in Mumbai aged 25–40 who shop premium brands"*
2. The AI asks 1–2 clarifying questions (campaign goal, geography, target persona)
3. The AI recommends a set of targeting signals (location, demographic, interest, behavior, transaction)
4. The planner refines through conversation — add signals, remove them, change the geography
5. When satisfied, the planner clicks **Confirm Audience** to lock it in
6. Confirmed audiences can be exported to a group chat for team review
7. Admins can view all confirmed audiences in a dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (via better-sqlite3) |
| AI | OpenAI GPT-4o-mini with function calling |
| Real-time | Socket.IO |
| Auth | JWT (7-day expiry) |

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- An OpenAI API key

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and set:

```
PORT=3001
JWT_SECRET=any-long-random-string-you-choose
OPENAI_API_KEY=sk-proj-your-key-here
DATABASE_PATH=./data/sightline.db
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Run the app

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

### 4. Create your first accounts

- Go to the login page and click **Register**
- Create an **admin** account first (to access the dashboard and create groups)
- Create a **planner** account to test the chat interface

---

## Project Structure

```
zerotooneai/
├── backend/
│   └── src/
│       ├── data/           # Taxonomy CSV files + embedding cache
│       ├── db/             # SQLite schema and setup
│       ├── middleware/     # JWT verification
│       ├── routes/
│       │   ├── auth.ts     # Login, register, /me
│       │   ├── chat.ts     # AI chat logic (main file)
│       │   ├── conversations.ts
│       │   └── groups.ts   # Group management
│       ├── socket.ts       # Real-time WebSocket events
│       ├── config.ts       # Env vars
│       └── index.ts        # Express app entry
│
└── frontend/
    └── src/
        ├── components/
        │   ├── AudiencePanel.tsx    # Right sidebar: signals + reach
        │   ├── SignalCard.tsx       # Individual signal display
        │   ├── AdminDashboard.tsx   # Admin view
        │   └── PlannerDashboard.tsx # Planner conversation history
        ├── hooks/
        │   └── useAuth.ts          # Auth state and context
        ├── lib/
        │   ├── api.ts              # All API calls
        │   └── socket.ts           # WebSocket client
        └── pages/
            ├── LoginPage.tsx
            ├── ChatPage.tsx        # Main chat interface
            ├── GroupChatPage.tsx   # Group collaboration
            ├── JoinPage.tsx        # Join via invite link
            └── AdminPage.tsx       # Admin dashboard
```

---

## User Roles

| Role | Can do |
|---|---|
| **Planner** | Create conversations, chat with AI, confirm audiences, export audiences to group chat, join any number of groups via invite link or URL |
| **Admin** | Everything planners can do + view all confirmed audiences across all planners + create and manage groups + regenerate invite links |

---

## Auth Flows

**Standard registration** — any user can register with email, name, and password and choose a role (admin or planner).

**Invite-link registration** — opening a group invite URL (`/join/:code`) presents a registration form. Submitting it creates the account, adds the user to the group, and logs them in immediately — no separate login step required.

**Existing user join** — a logged-in user can paste a group invite URL or code into the "Join a group" input in the sidebar to join additional groups without leaving the app.

---

## Group Collaboration

### For admins
- Create named groups from the sidebar
- Each group gets a unique invite link; the link can be regenerated at any time
- All created groups are listed in the sidebar — there is no limit on how many groups an admin can own
- View all group members and chat in a real-time group channel
- Export confirmed audience cards directly into the group chat

### For planners
- Join any number of groups using an invite URL or raw invite code via the "Join a group" button in the sidebar
- Each group appears as a separate entry in the sidebar
- Chat in real-time with other members; audience exports from any member appear inline in the chat

### Unread notifications
A small indicator appears on a group's icon in the sidebar whenever new messages arrive while the user is not viewing that group's chat. It clears as soon as they open the group.

### Audience export
After confirming an audience in the AI chat, the planner can click **Share to Group** to post a summary card into the group chat. All group members see the card in real-time, including the signal breakdown and reach estimate.

---

## Collaborative AI Conversations

A planner can invite other platform members into their AI conversation. Invited members join a shared chat window and can send messages to the same AI context. The audience signals and reach panel update for all participants simultaneously over WebSocket.

---

## Extra Features

**Real-time updates**
All conversation activity — new messages, signal changes, participant joins — is pushed over WebSocket (Socket.IO) so multiple users see changes without refreshing.

**Rejection memory**
When a planner removes a signal, the AI remembers it for that conversation and never re-suggests it. This prevents the AI from looping back to signals the user already rejected.

**Semantic signal search**
At startup, the backend generates embeddings (via `text-embedding-3-small`) for all taxonomy signals and caches them. When the AI searches for relevant signals, it uses semantic similarity rather than keyword matching. Keyword search is used as a fallback while the embeddings are being built.

**Conversation titles**
The first message in a new conversation automatically generates a short title which appears immediately in the sidebar — no page reload required.

**Planner dashboard**
Planners see their conversation history grouped by time (Today, Yesterday, Last 7 Days, Older) with search and quick status indicators.

**Admin analytics**
Admins see confirmed audience counts by user, message counts per conversation, and group membership — all in one view.

**Many-to-many group membership**
Users are not limited to a single group. Any user can belong to as many groups as they want. Membership is stored in a `user_groups` junction table so every group list and member count is always accurate.

---

## How the AI Works

The AI follows a structured 4-stage conversation:

**Stage 1 — Understand**
Asks 1–2 clarifying questions about campaign goal, geography, and target persona before recommending anything.

**Stage 2 — Recommend**
Uses OpenAI **function calling** (not text parsing) to return a structured list of signal IDs. This means signal extraction is reliable — the model cannot return a signal ID that doesn't exist in the taxonomy.

**Stage 3 — Refine**
Accepts follow-up instructions like "make it broader", "focus on Delhi only", or "add cricket fans". Each refinement re-calls the function with the updated full signal set.

**Stage 4 — Confirm**
Summarizes the audience and prompts the planner to confirm.

### Reach Estimation

No real count data is provided, so reach is estimated using a 500M addressable universe (digitally reachable Indians) with this logic:

- Signals of the **same type** are treated as OR (additive) — being in Mumbai OR Delhi
- Signals of **different types** are treated as AND (multiplicative) — in Mumbai AND interested in fitness
- A **1.4× overlap correction** accounts for positive correlations (e.g., high-net-worth users are more likely to be in metros)
- Confidence is rated high/medium/low based on signal count

---

## API Endpoints

```
POST    /api/auth/register
POST    /api/auth/register/invite/:code       (register + join group in one step)
POST    /api/auth/login
GET     /api/auth/me                          (returns user + all group memberships)
GET     /api/auth/users                       (platform-connected users, for invites)

GET     /api/conversations
POST    /api/conversations
GET     /api/conversations/:id
PATCH   /api/conversations/:id
POST    /api/conversations/:id/confirm
DELETE  /api/conversations/:id
GET     /api/conversations/admin/confirmed    (admin only)

POST    /api/chat/:conversationId/message
DELETE  /api/chat/:conversationId/signals/:signalId
GET     /api/chat/:conversationId/participants
POST    /api/chat/:conversationId/invite

GET     /api/groups                           (groups the current user belongs to)
POST    /api/groups                           (admin only — create group)
GET     /api/groups/invite/:code              (public — fetch group info for join page)
POST    /api/groups/join/:code                (join group; returns fresh JWT)
POST    /api/groups/:id/regenerate-invite     (admin only)
GET     /api/groups/:id/members
GET     /api/groups/:id/messages
POST    /api/groups/:id/messages
POST    /api/groups/:id/export-audience
DELETE  /api/groups/:id                       (admin only)
```

---

## Design Decisions

**Why SQLite?**
Simple, zero-config, and practical for a take-home project. The schema would move to PostgreSQL with minimal changes — the queries use no SQLite-specific features.

**Why function calling instead of prompt parsing?**
Parsing JSON out of free-form text is fragile. OpenAI function calling forces the model to return a validated structure, so signal IDs are always exact matches from the taxonomy — no hallucinations.

**Why GPT-4o-mini?**
Good balance of speed, cost, and quality for a structured task like this. Function calling support is solid, and the cost is low enough to run many refinement turns without concern.

**Why Socket.IO over polling?**
Group collaboration needs real-time feel. Polling would work for a single-user flow, but once multiple users can share a conversation or group chat, push updates are the right call. Socket.IO handles reconnection and fallback automatically.

**Why embeddings for signal search?**
The taxonomy has 300+ signals. Keyword search fails for semantic matches — a user saying "people who travel a lot" won't match a signal labelled "frequent flyer" unless you use embeddings. The cache is built once at startup so there's no per-request latency after that.

**Why store rejected signals in the conversation?**
The AI has no memory between messages by default. Storing rejections in the database and injecting them into the system prompt each turn is the simplest way to give the AI persistent context without building a full memory layer.

**Why a junction table for group membership?**
The original design stored a single `group_id` on each user, limiting them to one group. A `user_groups` junction table makes membership many-to-many with no schema changes to the `users` table, and existing memberships are migrated automatically on first startup.
