# FlowBoard - Real-Time Collaborative Kanban

A multi-user Kanban board where every card move, edit and reorder is streamed to
all connected teammates over WebSockets. Boards are private: only members can
read or mutate them, and that rule is enforced on the REST API *and* on the
real-time topic itself.

**Stack:** Spring Boot 3.5 (Java 21) | PostgreSQL 13+ | Flyway | JWT | 
STOMP-over-SockJS | React 18 | Vite | TypeScript | Tailwind CSS

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Real-time protocol](#real-time-protocol)
- [Testing](#testing)
- [QA tooling](#qa-tooling)
- [Security model](#security-model)
- [Known limitations](#known-limitations)

---

## Features

| Area | Behaviour |
| --- | --- |
| **Auth** | Email/password sign-up and sign-in, BCrypt hashes, stateless 24 h JWTs |
| **Boards** | Create, search, browse; per-board member roles (`OWNER` / `ADMIN` / `MEMBER`) |
| **Columns** | Create, rename, reorder (drag or arrow keys), delete (admin/owner only) |
| **Cards** | Create, edit title/description/priority, delete, drag between and within columns |
| **Members** | Owner invites as `MEMBER` or `ADMIN` and promotes/demotes later; roles stream live |
| **Real time** | Every mutation is broadcast to the board topic after the transaction commits |
| **Concurrency** | `@Version` optimistic locking; conflicting moves return `409` and clients resync |
| **Activity log** | Durable audit trail, paginated, streamed live to the feed |
| **Ordering** | Fractional positions - a drag rewrites one row instead of re-indexing siblings |
| **Resilience** | Clients refetch board state on reconnect and after a lost write race |

---

## Architecture

```
Browser (React + @hello-pangea/dnd)
   |
   |  HTTP/JSON  -------------->  REST API  -->  Services  -->  JPA  -->  PostgreSQL
   |                                   |
   |                                   +-- BoardAccessGuard (membership + role)
   |
   +-- STOMP over SockJS  ------>  /ws-board  -->  JwtChannelInterceptor
                                          |           (CONNECT + SUBSCRIBE auth)
                                          +-- /topic/board/{boardId} --> members
```

Two rules shape the design:

1. **Broadcasts happen after commit.** Services publish an internal Spring event;
   `BoardEventPublisher` sends it on `AFTER_COMMIT`, so a client that reacts to an
   event by calling the REST API can never read state that is not yet visible.
2. **Activity logging can never fail a user action.** `ActivityLogService` listens
   `AFTER_COMMIT` in a `REQUIRES_NEW` transaction and swallows its own errors.

### Ordering model

`board_lists.position` and `cards.position` are `DOUBLE PRECISION` fractional
indices. Inserting between `A` and `B` writes `(A + B) / 2` - one row updated
instead of `O(n)` re-indexing. `@Version` columns on `cards` and `board_lists`
turn concurrent writes into a `409` rather than a lost update.

---

## Project layout

```
.
|-- pom.xml                     Maven build (backend)
|-- .env.example                Required environment variables
|-- src/main/java/com/taskboard/
|   |-- config/                 Security, JWT and WebSocket configuration
|   |-- security/               JWT issuing/parsing, STOMP interceptor
|   |-- web/                    REST controllers
|   |-- service/                Business logic + BoardAccessGuard
|   |-- board|list|card/        Entities and repositories
|   |-- activity/               Audit trail (entity + event listener)
|   |-- websocket/              Event publisher and payload records
|   +-- common/exception/       RFC 7807 error handling
|-- src/main/resources/
|   |-- application.yml
|   +-- db/migration/           Flyway migrations (schema is owned here)
|-- src/test/java/              JUnit 5 + Mockito
|-- frontend/src/
|   |-- api/                    Typed axios client
|   |-- components/board/       ListColumn, CardItem, modals, activity feed
|   |-- context/                Auth, WebSocket and Toast providers
|   |-- pages/                  Login, Register, Dashboard, Board
|   +-- utils/boardState.ts     Drag/drop reducers (pure, unit tested)
+-- tools/                      QA harness (see QA tooling)
```

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| JDK | 21+ | The build targets `java.version` 21 |
| Maven | 3.9+ | Any recent 3.x works |
| PostgreSQL | 13+ | Flyway warns on newer majors; 13-18 all work |
| Node.js | 18+ | 20 LTS or 22 recommended |

---

## Getting started

### 1. Database

Create a database and a role. The schema itself is created by Flyway on first
boot - you do not need to run any DDL.

```sql
CREATE DATABASE taskboard;
```

### 2. Environment

Copy the template and fill it in:

```bash
cp .env.example .env
```

`.env` is git-ignored. Load it into your shell:

```powershell
# PowerShell
Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } |
  ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$k" -Value $v }
```

```bash
# bash / zsh
set -a && . ./.env && set +a
```

> `JWT_SECRET` has **no default on purpose**. Generate one with
> `openssl rand -base64 48`. A committed signing key would let anyone mint a
> valid token for any deployment that forgot to override it.

### 3. Backend

```bash
mvn spring-boot:run      # http://localhost:8080
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Sign up, create a board, and drag a card between columns. Open the same board in
a second browser to watch the live sync.


---

## Configuration

All settings are environment variables; `.env.example` lists them all.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL endpoint |
| `DB_NAME` / `DB_USER` / `DB_PASS` | `taskboard` / `taskboard` / `taskboard` | Credentials |
| `JWT_SECRET` | **required** | HMAC-SHA256 signing key, 32 bytes or more |
| `JWT_EXPIRATION_MS` | `86400000` (24 h) | Token lifetime |
| `SERVER_PORT` | `8080` | HTTP port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated API + WebSocket origins |

### Frontend build-time configuration

The frontend is built by Vite, so its settings are `VITE_*` variables in
`frontend/.env` (see `frontend/.env.example`). They are baked into the bundle
at build time, which is why they are not environment variables at runtime.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | Base URL of the REST API |
| `VITE_WS_URL` | derived from `VITE_API_BASE_URL` | SockJS/STOMP endpoint |

Both are optional: without a `.env` file the defaults reproduce the previous
hardcoded values, so local development is unchanged. `VITE_WS_URL` is derived
rather than repeated, so pointing the app at another backend
(`VITE_API_BASE_URL=https://api.example.com`) moves the WebSocket with it.

The `connect-src` of the Content-Security-Policy is generated from these same
two values by `frontend/src/config/endpoints.ts`, which is imported by both
`src/api/client.ts` and `vite.config.ts`. That is deliberate: a `connect-src`
that disagreed with the URLs the app actually calls would not raise an error,
it would silently block every fetch and socket. There is one source of truth
rather than two copies to keep in step.

To deploy the frontend somewhere other than `localhost:5173`, set the frontend
variables **and** add that origin to the backend's `CORS_ALLOWED_ORIGINS`.

---

## API reference

All routes except sign-up and sign-in require `Authorization: Bearer <jwt>`.
Errors are RFC 7807 `application/problem+json`.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | `{ email, displayName, password }` returns token + user |
| `POST` | `/api/auth/login` | `{ email, password }` returns token + user |
| `GET` | `/api/auth/me` | Current user; `401` without a valid token |

### Boards

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/boards` | member |
| `POST` | `/api/boards` | authenticated |
| `GET` | `/api/boards/{boardId}` | member |
| `GET` | `/api/boards/{boardId}/members` | member |
| `POST` | `/api/boards/{boardId}/members` | admin (owner only for an `ADMIN` invite) |
| `PATCH` | `/api/boards/{boardId}/members/{userId}/role` | owner |
| `GET` | `/api/boards/{boardId}/activity?page=&size=` | member |

The activity endpoint returns an explicit page envelope rather than a
serialised Spring `Page`, so the client depends on field names this project
owns instead of `PageImpl` internals:

```json
{ "items": [ ... ], "hasMore": true, "nextPage": 1, "total": 44 }
```

### Lists

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/boards/{boardId}/lists` | member |
| `PATCH` | `/api/boards/{boardId}/lists/{listId}` | member |
| `PATCH` | `/api/boards/{boardId}/lists/{listId}/move` | member |
| `DELETE` | `/api/boards/{boardId}/lists/{listId}` | admin |

### Cards

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/boards/{boardId}/lists/{listId}/cards` | member |
| `PATCH` | `/api/boards/{boardId}/cards/{cardId}` | member |
| `PATCH` | `/api/boards/{boardId}/cards/{cardId}/move` | member |
| `DELETE` | `/api/boards/{boardId}/cards/{cardId}` | member |

### Status codes

| Code | When |
| --- | --- |
| `400` | Validation failure, malformed JSON, unparseable path or query parameter |
| `401` | Missing, malformed or expired token |
| `403` | Authenticated but not a member of the board, or lacking the role |
| `404` | Board, list or card not found on that board |
| `409` | Optimistic-lock conflict, or a unique-constraint race |

---

## Real-time protocol

**Endpoint:** `/ws-board` (SockJS, with raw-WebSocket fallback)
**Client:** `@stomp/stompjs` + `sockjs-client`
**Topic:** `/topic/board/{boardId}`

The JWT travels as a native header on the STOMP `CONNECT` frame:

```js
new Client({
  webSocketFactory: () => new SockJS(WS_URL),
  connectHeaders: { Authorization: `Bearer ${token}` },
  reconnectDelay: 5000,
});
```

Every broadcast uses the same envelope:

```json
{
  "type": "CARD_MOVED",
  "boardId": "...",
  "occurredAt": "2026-09-26T12:00:00Z",
  "payload": {
    "cardId": "...",
    "fromListId": "...",
    "toListId": "...",
    "newPosition": 1500.0,
    "actorId": "...",
    "version": 3
  }
}
```

| Event | Payload |
| --- | --- |
| `CARD_CREATED` / `CARD_UPDATED` | full card state |
| `CARD_MOVED` | card id, from/to list, fractional position, new `version` |
| `CARD_DELETED` | card id, list id |
| `LIST_CREATED` / `LIST_UPDATED` | list id, name, position, version |
| `LIST_DELETED` | list id |
| `MEMBER_ADDED` / `MEMBER_UPDATED` | member summary (add and role change) |
| `ACTIVITY` | id, actor, type, message, timestamp |

**Authorization.** `CONNECT` is validated for a live JWT, and every `SUBSCRIBE`
is checked against board membership. A non-member subscribing to a board topic
receives a STOMP `ERROR` frame and no events.


---

## Testing

```bash
# Backend - JUnit 5 + Mockito
mvn test

# Frontend - Node's built-in test runner, nothing extra to install
cd frontend
npm test          # unit tests for the drag/drop reducers
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production bundle
```

Backend tests cover the STOMP channel's authentication and subscription
authorization, the exception-to-status-code mapping, and the member role rules
(owner-only promotion, `ADMIN` escalation blocked, immutable owner row).

---

## QA tooling

`tools/` holds a zero-dependency browser harness that drives Chrome over the
DevTools Protocol, plus a CLI probe for the API. This is how the drag-and-drop
regressions in this project were found and verified.

```bash
# Seed a user, board, lists and cards through the REST API
powershell -ExecutionPolicy Bypass -File tools/seed.ps1

# Edge-case matrix: malformed input, authorization, IDOR, membership, paging
powershell -ExecutionPolicy Bypass -File tools/apiprobe.ps1

# Security regression: can a NON-member read another board's live event stream?
# Exits non-zero while the board topic is unprotected.
node tools/wsauthcheck.mjs

node tools/wsmemberupd.mjs    # does a role change reach a member's live board topic?

# Browser scenarios (needs Chrome started with --remote-debugging-port=9222)
$env:QA_TOKEN=...; $env:QA_BOARD_ID=...
node tools/uicheck.mjs dnd         # drag a card across columns, measure the preview
node tools/uicheck.mjs droptest    # assert drops land on the expected index
node tools/uicheck.mjs dndfix      # measure cursor-to-card offset during a drag
node tools/uicheck.mjs coldrag     # assert the column grip starts a drag
node tools/uicheck.mjs createboard # assert the dashboard refreshes after a create

# Drop-index diagnostics: sweep the aim point and print the resulting index.
node tools/dropcurve.mjs           # response curve across a target column
node tools/dropoffset.mjs          # fixed-pixel offsets from the droppable's bottom
node tools/dropgeom.mjs            # per-column geometry: scroll height, dead space

# Load the production build under the CSP in Chrome; exits non-zero on any
# violation or a blank render.
npm run build && npm run preview -- --port 4173
node tools/cspcheck.mjs
```

Screenshots are written to `.uiqa/`, which is git-ignored.

---

## Security model

- **Passwords** are BCrypt hashes and are never returned by any endpoint.
- **Tokens** are stateless HMAC-SHA256 JWTs. Logout is client-side, so a
  24-hour token stays valid until it expires.
- **Authorization** is centralised in `BoardAccessGuard` and applied to every
  board-scoped REST call *and* to STOMP `SUBSCRIBE` frames.
- **Privilege changes are owner-only.** An `ADMIN` may invite colleagues as
  `MEMBER`, but only the `OWNER` can mint or revoke an `ADMIN`, so an admin
  cannot escalate a peer above the owner's intent. `OWNER` is never assignable
  through the API and the board's owner row is immutable.
- **Cross-board access** is re-checked at the entity level: a card or list id
  belonging to another board returns `404` rather than mutating it.
- **Secrets** are environment-only; `JWT_SECRET` has no committed default.
- **Response headers.** Every API response carries `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`, and
  `Strict-Transport-Security` when the request arrived over TLS. The filter is
  registered ahead of authentication, so 401s are covered too.
- **Content-Security-Policy travels with the document, not from the API.** The
  backend serves only JSON, so a CSP set there would never be evaluated by a
  browser. The policy is generated by `frontend/src/config/endpoints.ts` from
  the same resolved endpoints the app calls, is sent as a header by the
  dev/preview server, and is injected as a `<meta>` tag into the production
  build. `script-src` omits `unsafe-inline` and `unsafe-eval`, which the app
  does not need. `tools/cspcheck.mjs` loads the built app under the policy in
  Chrome and fails on any violation, because a mis-scoped policy breaks fetches
  and sockets silently rather than loudly.

---

## Known limitations

Real and tracked, not hypotheticals:

- **The JWT lives in `localStorage`**, so any XSS could exfiltrate a 24-hour
  token. Move to `HttpOnly` cookies plus a refresh token before production.
- **Sign-up does not reveal which addresses are registered.** A duplicate
  email answers `201` with a `null` user rather than `409`, so the status code
  is not an enumeration oracle. No session is issued in that case, so the
  endpoint cannot be used to claim an existing account. The trade-off is that
  someone re-using their own address must sign in instead of re-registering.
- **No rate limiting** on `/api/auth/login` or `/signup`, so login is still
  brute-forceable. Verification of no enumeration closes the address oracle
  but does nothing about credential guessing.
- **The Content-Security-Policy is delivered as a `<meta>` tag in the built
  `index.html`, not as a response header.** A meta policy is weaker: it is
  ignored for `frame-ancestors` and does not cover the response before the
  document is parsed. Configure your static host to send the header from
  `frontend/src/config/endpoints.ts` (`buildCsp`) and this stops mattering.
  `connect-src` is generated from the same resolved `API_BASE_URL`/`WS_URL`, so
  it cannot drift out of step with the URLs the app calls.
- **The activity feed pages on demand** ("Load older activity", 30 rows a page) and
  keeps a 300-row client buffer. Rows beyond the buffer are still reachable by
  paging; live events stop at the buffer edge.
- **No card virtualisation**: very large lists render every card and re-render
  on each event.
- **`@hello-pangea/dnd` warns about nested scroll containers** because a Kanban
  board needs both a horizontal board scroller and per-column vertical
  scrollers. The warning is cosmetic in this layout: measured with
  `tools/dropcurve.mjs`, the drop-index response is monotonic for a short column
  and for a 40-card column that genuinely scrolls, and the end-of-list index is
  reachable. `uicheck.mjs droptest` asserts this (3/3).

---

## License

Proprietary - all rights reserved.

