# PM REST API contract

This document describes the HTTP API of the PM template. The mock server in
`src/data/api/mock-server.ts` implements this contract. The Vite dev server mounts the mock at
`/api` (`vite.config.ts`). The React client in `src/data/api/client.ts` consumes it.

The API is a demo backend. It keeps all data in memory. It does not persist data. It resets the
data when the dev server restarts.

The mock is mounted **only by the Vite dev server**. Production builds always use the Dexie
(IndexedDB) data source; there is no deployable API. The client picks the source at startup
(`src/data/source.ts`): `localStorage["oas-pm-data"] === "api"` plus `import.meta.env.DEV`, otherwise
Dexie. API mode also requires a login session (section 2).

## 1. Conventions

- Base path: `/api`. All bodies are JSON (`content-type: application/json`).
- All paths and query values are UTF-8. Path segments are URI-encoded.
- Error bodies are always `{ "error": "<message>" }`. The message is English and stable enough for
  logs. The UI shows its own localized message.
- Times are Unix epoch milliseconds (`number`).
- IDs are strings. The seed uses `project-1`, `member-1`, `issue-…`, `cycle-1`, and similar.
- Responses use `items` for lists. A list response has the shape `{ "items": [...] }`.
- Successful writes bump the revision counter (see section 3) and return `{ "ok": true }` unless a
  section below says otherwise.
- The list **window** is 200 rows (`LIST_WINDOW`). `limit` defaults to 200; the web client grows it
  by 200 per scroll step (`LIST_WINDOW_STEP`). Search has its own cap of 2000 rows.

## 2. Authentication

### 2.1 Model

- The client sends `Authorization: Bearer <token>` on every request.
- The server issues an opaque token on login. The token starts with `mock-`.
- The server keeps a session table in memory: `token -> member snapshot`. A server restart loses
  all sessions. All tokens then return `401`.
- Only `POST /api/auth/login` and `POST /api/auth/logout` accept anonymous calls. Every other
  endpoint, including `GET /api/revision`, returns `401` without a valid token.
- The demo password is `oas` for every seed member.
- Seed accounts: `user1@oas.dev` (admin), `user2@oas.dev` (member), `user3@oas.dev` (member),
  `user4@oas.dev` … `user8@oas.dev` (viewer).
- Email match is case-insensitive.
- The login page offers three quick-login buttons: `user1@oas.dev`, `user2@oas.dev`, and
  `user4@oas.dev`.

### 2.2 `POST /api/auth/login`

Request:

```json
{ "email": "user1@oas.dev", "password": "oas" }
```

Response `200`:

```json
{ "token": "mock-0f8c…", "member": { "id": "member-1", "name": "张伟", "role": "admin", … } }
```

Errors:

| Status | When |
| --- | --- |
| `400` | `email` or `password` is missing |
| `401` | Unknown email or wrong password. The message is the same for both cases. |
| `405` | Method is not `POST` |

### 2.3 `GET /api/auth/me`

Returns the current member. Requires a valid token.

Response `200`: `{ "member": { … } }`

Error `401`: token is missing, unknown, or revoked.

The member is the current row from the member table. If the row no longer exists, the server
returns the snapshot taken at login. A session therefore survives table wipes and member deletion.

### 2.4 `POST /api/auth/logout`

Revokes the given token. The call is idempotent, and it does not require a valid token.

Response: `204` with no body.

### 2.5 Authorization (who may call what)

The mock is no longer "any token can write". Every call resolves the caller's role and checks an
action id from `src/permission/policy.ts`. The rules are the same as the client policy:

- **Workspace role**: `members.role` points at a built-in role (`admin`, `member`, `viewer`) or a
  custom role from the `roles` table.
- **Project override**: `projectRoles` may replace the role inside one project. A workspace admin is
  never overridden. Project-scoped roles cannot carry workspace actions.
- **Custom roles** grant their `permissions` set unconditionally. Built-in roles keep the
  "own issue / own comment" conditions of `can()`.

Action sets:

| Role | May |
| --- | --- |
| `admin` | All 15 actions, in every project and at workspace level |
| `member` | `issue:create`, `comment:create`, `view:save`, `view:delete`; `issue:edit`, `issue:change-status`, `issue:change-assignee` only when the member is the assignee or reporter; `comment:edit`/`comment:delete` only on their own comments |
| `viewer` | Read only. Any write returns `403`. |
| custom role | Exactly its `permissions` list (`project` scope: workspace actions are stripped) |

Endpoint gating:

| Endpoint group | Required action |
| --- | --- |
| `GET` issues / comments / activities / saved views / cycles / notifications / settings, `GET /api/revision` | Any valid token (reads are not restricted per row) |
| `GET /api/roles`, `/api/project-roles`, `/api/project-members` | Any valid token (the client needs them to resolve the caller's effective permissions) |
| `POST/PATCH/DELETE` issues | action per field/operation (`issue:create`, `issue:edit`, `issue:change-status`, `issue:change-assignee`, `issue:delete`, `bulk:apply`, `bulk:delete`) with `Ctx` = current issue |
| comments, activities, saved views | `comment:create/edit/delete`, action implied by activity `type`, `view:save` / `view:delete` |
| `GET /api/issues?deleted=1` | `workspace:manage` |
| `POST /api/issues/:id/restore` | `issue:delete` or `bulk:delete` for the issue |
| `DELETE /api/issues/:id/purge` | `workspace:manage` |
| `POST/PATCH/DELETE /api/projects*`, `/api/cycles*` | `project:manage` |
| `POST/PATCH/DELETE /api/members*` (except self-profile) | `member:manage` |
| role change (`PATCH /api/members/:id` with `role`), `POST /api/members` with a role | `workspace:manage` |
| `POST/PATCH/DELETE /api/roles*`, `PUT /api/settings/:key` | `workspace:manage` |
| `GET /api/admin/stats|workload|health`, `GET /api/audit` | Any admin capability (`project:manage` OR `member:manage` OR `workspace:manage`) |
| `GET /api/admin/export` | `workspace:manage` |
| `POST /api/admin/*` (export/import/reset/wipe) | `workspace:manage` |
| `POST /api/audit` | Any admin capability |
| `GET /api/audit` | Any admin capability (project/member/workspace) |
| `PUT /api/project-roles`, `PUT /api/project-members` | Any admin capability |
| No token | `401` |

Self-service: `PATCH /api/members/:me` skips the admin gate. Without `member:manage`, only
`name`, `title`, `timezone` and `avatarColor` are accepted; `email` and `role` are admin-managed
(`403 "field is admin-managed"`).

A denied call returns `403` with `{ "error": "permission denied" }`. The frontend also hides these
actions with its client-side policy (`src/permission/policy.ts`). The server check is the authority.

Actor identity: `POST /api/comments` and `POST /api/activities` take the author/actor from the
session. A body `authorId` / `actorId` is honored only when the caller has `workspace:manage`
(import/repair scenarios).

## 3. Change polling

`GET /api/revision` returns `{ "revision": <number> }`. The counter starts at `0` and increases by
one on every successful write.

Client protocol:

1. Read `revision`. Call this value the baseline.
2. Load the data.
3. Poll `revision` every 1200 ms. If the value differs from the last seen value, load the data
   again.
4. Stop polling when the last subscription ends.

Purposes:

- A single poll channel serves all views.
- A failed poll does not end the subscription. The next poll tries again.
- A `401` during polling ends the session (section 2.1).

## 4. Query parameters

### 4.1 Multi-value filters

`status`, `assignee` and `priority` accept a comma-separated list. Values inside one parameter are
OR-ed. Different parameters are AND-ed. An empty or missing parameter means "no restriction".

Example: `?projectId=project-1&status=todo,done&priority=urgent`

### 4.2 Sentinel values

| Sentinel | Field | Meaning |
| --- | --- | --- |
| `__all__` | `projectId` | All projects (cross-project scope). An empty `projectId` is **not** the same: it matches no project. |
| `__none__` | `assignee` | Issues without an assignee |
| `__none__` | `cycle` | Issues that are not in any cycle |
| `__current__` | `cycle` | Cycles that contain the current time. The server derives this from the cycle table and the current time. |

`cycle` also accepts a concrete cycle ID. The server then selects the whole cycle. The
`updatedAt` window does not cut the result. This is how closed cycles stay readable.

### 4.3 Limits

- `limit` defaults to the list window (**200**) on window queries. The client starts at 200 and adds
  200 per scroll step. Concrete-cycle reads (`cycle=<id>`) ignore the `updatedAt` window, so old
  cycles stay complete.
- `search` scans the whole issue table and returns at most 2000 rows.

## 5. Issues

### 5.1 `GET /api/issues` (list window)

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| `projectId` | string | Project ID or `__all__` |
| `status` | csv | Issue status values |
| `assignee` | csv | Member IDs, or `__none__` |
| `priority` | csv | `urgent`, `high`, `medium`, `low` |
| `search` | string | Case-insensitive match on key or title |
| `myOnly` | `1` | Keep rows assigned to `currentUser` |
| `currentUser` | string | Member ID used by `myOnly` |
| `sortBy` | enum | `updatedAt` (default), `priority`, `createdAt` |
| `cycle` | string | Cycle ID, `__current__`, `__none__`, or omitted |
| `limit` | number | Window size (default 200) |

Response `200`: `{ "items": [Issue, …] }`

Rules:

- The server applies the project and status filter first, sorts by `updatedAt` (descending), then
  cuts the window, then applies `assignee`, `priority`, `myOnly` and `cycle` inside the window.
- `search` uses its own path: full table scan, key order, limit 2000, then the same post-filters.

### 5.2 `POST /api/issues`

Request: `{ projectId, title, status, priority, assigneeId, reporterId, parentId?, order? }`

Response `201`: `{ "issue": Issue }`. The server allocates the next key number from the project.

### 5.3 `PATCH /api/issues`

Request: `{ "updates": [ { "id": "issue-…", "changes": { … } } ] }`

Response `200`: `{ "ok": true }`. The server skips unknown IDs.

### 5.4 `GET /api/issues/:id`

Response `200`: `{ "issue": Issue }`. Error `404`: unknown ID.

### 5.5 `PATCH /api/issues/:id`

Request: `{ "changes": { … } }`. The server sets `updatedAt` to the current time.

Response `200`: `{ "ok": true }`. Error `404`: unknown ID.

### 5.6 `DELETE /api/issues/:id`

Soft delete. The server sets `deletedAt` to the current time and keeps the row. `updatedAt` does
not change, so a restored row keeps its list position.

Response `200`: `{ "ok": true }`. Error `404`: unknown ID.

Deleted rows are excluded from every query: the list window, `search`, counts (including
`byPriority`), sub-issues, relation candidates, created-since, workload, cycle counts, cycle issues,
`bulk`, `all`, and the dashboard/admin requests. `GET /api/issues/:id` returns `404` for a deleted
row. `PATCH /api/issues/:id` on a deleted row is a silent no-op (still `{ "ok": true }`).

The web client shows a 6-second undo bar after a delete; undo calls `restore`. `bulk-delete` is the
same soft delete.

### 5.6.1 Trash endpoints

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/issues?deleted=1` | `{ items }` | Trash list. Sorted by `deletedAt` descending, then by ID descending. Requires `workspace:manage` (not just any admin capability). Other query parameters are ignored. |
| `POST /api/issues/:id/restore` | `{ ok: true }` | Clears `deletedAt`. Requires `workspace:manage`. A row that is not deleted is a no-op. `404` for an unknown ID. |
| `DELETE /api/issues/:id/purge` | `{ ok: true }` | Physical delete. Requires `workspace:manage`. `409` when the row is not in the trash. `404` for an unknown ID. Cascades: deletes the issue's comments, activities and notifications, and sets `parentId = null` on its sub-issues. |

### 5.7 `GET /api/issues/:id/sub-issues`

Response `200`: `{ "items": [Issue, …] }` (children by `parentId`, ID ascending).

### 5.8 Issue helper endpoints

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/issues/all?limit=` | `{ items }` | All issues, ID ascending, limited |
| `GET /api/issues/bulk?ids=a,b` | `{ items: [Issue \| null] }` | Positional result; `null` for unknown IDs |
| `GET /api/issues/counts?projectId=` | `{ total, byStatus, byPriority }` | Counts over the whole project (or `__all__`) after excluding soft-deleted rows. `byStatus` has all five status keys; `byPriority` has `urgent/high/medium/low`. |
| `GET /api/issues/cycle-counts?projectId=` | `{ items: [{ cycleId, total, done, cancelled }] }` | `cycleId: null` is the "no cycle" bucket; the null bucket comes first |
| `GET /api/issues/cycle-issues?projectId=&cycleId=` | `{ items }` | Whole cycle, ID ascending |
| `GET /api/issues/workload?projectId=` | `{ items: [{ memberId, count }] }` | Assignee counts in the project |
| `GET /api/issues/created-since?since=<ms>` | `{ items }` | Created at or after `since`, created-at ascending |
| `GET /api/issues/relation-candidates?projectId=&limit=` | `{ items }` | ID ascending |
| `POST /api/issues/bulk-apply` | `{ ok: true }` | Body `{ ids, patch: { status?, priority?, assigneeId? }, actorId }`. The server appends activity rows. |
| `POST /api/issues/bulk-delete` | `{ ok: true }` | Body `{ ids: string[] }`. Soft delete, same as `DELETE /api/issues/:id`. |

Reserved segments: `all`, `bulk`, `counts`, `cycle-counts`, `cycle-issues`, `workload`,
`created-since`, `relation-candidates`, `bulk-apply`, `bulk-delete`. An issue ID cannot use these
values.

## 6. Projects

All writes require `project:manage` (section 2.5).

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/projects` | – | `{ items }` (ID ascending) | – |
| `POST /api/projects` | Project object | `201 { ok: true }` | `409` duplicate ID or duplicate `key` |
| `GET /api/projects/:id` | – | `{ project }` | `404` |
| `PATCH /api/projects/:id` | `{ changes }` | `{ ok: true }` | `404`, `409` duplicate `key` |
| `DELETE /api/projects/:id` | – | `{ ok: true }` | `404`, `409` project still has issues |
| `POST /api/projects/:id/allocate-key` | – | `{ keyNum }` | `404` |

The `allocate-key` call increases `nextKeyNum` by one and returns the used number.

`DELETE` is allowed only when the project has no issue rows (soft-deleted rows count as rows, so an
empty project must be purged first). It cascades to `projectMembers`, `projectRoles` and `cycles`
of that project.

The web client, after creating a project, calls `PUT /api/project-members` with every current
member, so a new project starts with the full workspace directory.

## 7. Members

Writes require `member:manage`. Creating a member with a `role`, or changing `role`, additionally
requires `workspace:manage` (prevents a "manage members" holder from minting admins).

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/members` | – | `{ items }` (ID ascending) | – |
| `POST /api/members` | Member object | `201 { ok: true }` | `403` role without `workspace:manage`, `409` duplicate ID |
| `GET /api/members/:id` | – | `{ member }` | `404` |
| `PATCH /api/members/:id` | `{ changes }` | `{ ok: true }` | `400` unknown role or project-scope role, `403` self-profile field not allowed, `403` role without `workspace:manage`, `404`, `409` demoting the last admin |
| `DELETE /api/members/:id` | – | `{ ok: true }` | `409` removing the last admin |

`DELETE` clears the member from every issue assignee, deletes the member's `projectMembers` and
`projectRoles` rows, and **revokes every session of that member**. The call is idempotent: an
unknown ID returns `{ "ok": true }`.

`PATCH /api/members/:me` is self-service: without `member:manage` only `name`, `title`, `timezone`
and `avatarColor` are accepted. `email` and `role` are read-only for the member (the profile drawer
renders email as a disabled field). Assigning a role whose `scope` is `project` as a workspace role
is rejected with `400`.

## 7b. Roles

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/roles` | – | `{ items }` (ID ascending; built-in + custom) | Any valid token (permission resolution) |
| `POST /api/roles` | Role object (`id, name, description, scope?, permissions`) | `201 { ok: true }` | `400` missing id/name, `409` duplicate ID |
| `PATCH /api/roles/:id` | `{ changes }` | `{ ok: true }` | `403` built-in role, `404` |
| `DELETE /api/roles/:id` | – | `{ ok: true }` | `403` built-in role, `404`, `409` role assigned to members or used by a project override |

`permissions` is an array of action ids from `src/permission/policy.ts`. Built-in roles
(`admin`, `member`, `viewer`) are read-only and derive their permissions from `can()`; custom roles
grant their permission set unconditionally. `scope` is `workspace` (default) or `project` (offered as
a project override). Member assignment uses `PATCH /api/members/:id { changes: { role: "<role id>" } }`.

- Reads require an admin capability (`project:manage` OR `member:manage` OR `workspace:manage`).
- Writes require `workspace:manage`.
- `scope` is **immutable after creation**: `PATCH` ignores it. Creating or updating a `project` role
  silently strips workspace actions (`project:manage`, `member:manage`, `workspace:manage`).
- The role matrix in the admin console is display-only for built-in roles; a custom role can be
  created empty or by duplicating a built-in role.

## 7c. Project role overrides

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/project-roles` | – | `{ items }` (all overrides) | Any valid token (permission resolution) |
| `PUT /api/project-roles` | `{ projectId, memberId, roleId }` (`roleId: null` clears) | `{ ok: true }` | `400` unknown role, `400` role is not project scope, `400` member is not in the project, `400` missing ids, `404` project/member |

An override applies only inside the given project. **A workspace admin is never overridden.**
Project roles cannot carry workspace actions, so an override cannot escalate
`project:manage` / `member:manage` / `workspace:manage`.
Reads require an admin capability; writes require an admin capability (`project:manage`,
`member:manage` or `workspace:manage`).

## 7d. Audit log

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/audit?limit=20` | – | `{ items }` (newest first; default limit 20) | `403` without an admin capability |
| `POST /api/audit` | `{ id, at, actorId, action, target?, detail? }` | `201 { ok: true }` | `400` missing id/action |

Records role and assignment changes (`role.create`, `role.update`, `role.delete`,
`member.role`, `projectRole.set`, `projectRole.clear`, `projectMember.set`).
Reading and writing both require an admin capability; the audit log is not exposed to plain members.
The permissions page loads 20 rows and appends 20 per click, filters client-side, and exports the
filtered rows as a UTF-8-BOM CSV (`pm-audit.csv`). There is no retention policy and no
server-side export.

## 7e. Project members

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/project-members` | – | `{ items }` (`projectId` + `memberId`) | Any valid token (assignee scoping) |
| `PUT /api/project-members` | `{ projectId, memberIds: string[] }` | `{ ok: true }` | `400` unknown member, `404` project, `403` without an admin capability |

Project members scope the assignee picker and the member filter. The workspace directory
(`GET /api/members`) stays complete for the admin page; new projects are created with every
current member by the web client. Reads and writes both require an admin capability.

`PUT` replaces the project's member list. It also **prunes the project's role overrides** for
members that were removed from the list, so an override never applies to a non-member.

## 8. Comments

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/comments?issueId=` | – | `{ items }` created-at ascending | – |
| `POST /api/comments` | `{ issueId, authorId?, body, parentId? }` | `201 { comment }` | `403` without `comment:create`, `404` unknown issue / unknown parent comment |
| `PATCH /api/comments/:id` | `{ body }` | `{ ok: true }` | `403` not the author, `404` |
| `DELETE /api/comments/:id` | – | `{ ok: true }` | `403` not the author, `404` |

`authorId` is taken from the session; a body value is honored only for `workspace:manage` callers.
Members may edit/delete only their own comments; `admin` and custom roles with the permission may
edit/delete any comment. A comment write also creates notification rows (section 13).

**Threads (one level)**: `POST` accepts `parentId` — the id of the root comment. Replying to a
reply is flattened onto the same root (`parent.parentId || parent.id`); the parent must exist and
belong to the same issue (`404` otherwise). `DELETE /api/comments/:id` cascades to the thread's
replies (`parentId = :id`). The response comment includes `parentId` (`null` for roots).

## 9. Activities

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/activities?issueId=` | – | `{ items }` created-at descending | – |
| `GET /api/activities?recent=<n>` | – | `{ items }`, newest `n`, default 100 | – |
| `POST /api/activities` | `{ issueId, actorId?, type, field?, from?, to? }` | `201 { ok: true }` | `403` without the matching issue action, `404` unknown issue |

`issueId` wins over `recent` when both are present.
The activity `type` selects the permission check: `status` → `issue:change-status`, `assignee` →
`issue:change-assignee`, `comment` / `comment-edit` → `comment:create`, `delete` → `issue:delete`,
everything else → `issue:edit`. `actorId` comes from the session unless the caller has
`workspace:manage`. A stored activity also creates notifications (section 13).

## 10. Saved views

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/saved-views` | – | `{ items }` (name ascending) | – |
| `POST /api/saved-views` | `{ name, filters }` | `201 { ok: true }` | `403` without `view:save` |
| `DELETE /api/saved-views/:id` | – | `{ ok: true }` | `403` without `view:delete` |

The server stores `filters` as a JSON string. The client parses it on read. Views are workspace-wide
(not per member).

## 11. Cycles

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/cycles?projectId=` | project ID, `__all__`, or omitted (all) | `{ items }` start-at descending | – |
| `POST /api/cycles` | `{ projectId, name, startAt, endAt, goal? }` | `201 { cycle }` | – |
| `GET /api/cycles/:id` | – | `{ cycle }` | `404` |
| `PATCH /api/cycles/:id` | `{ changes }` | `{ ok: true }` | `404` |
| `DELETE /api/cycles/:id` | – | `{ ok: true }` | `404` |

`DELETE` does not delete issues. It sets their `cycleId` to `null` and updates `updatedAt`.
Writes require `project:manage`.

## 12. Settings

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/settings/:key` | – | `{ found: boolean, value }` | – |
| `PUT /api/settings/:key` | `{ value }` | `{ ok: true }` | – |

`GET` never returns `404`. A missing key returns `{ "found": false, "value": null }`. `PUT` requires
`workspace:manage`.

## 13. Notifications

The notification center keeps one row per receiver.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Row id |
| `memberId` | string | Receiver |
| `type` | string | `mention`, `assigned`, `comment`, `status`, `cycle`, `system` |
| `issueId` | string? | Related issue |
| `actorId` | string? | Member that triggered the event |
| `message` | string? | Comment snippet for `mention`/`comment`, status code for `status`, cycle name for `cycle` |
| `readAt` | number \| null | `null` means unread |
| `createdAt` | number | Epoch milliseconds |

### 13.1 Generation rules

The client and the mock server share the same rules (`src/lib/notify.ts`). A write hook creates rows at
the same points as the activity log:

- A comment that mentions a member with `@name` sends `mention` to that member.
- A comment on an issue sends `comment` to the assignee. The assignee does not get a second row when
  the same comment mentions them.
- An assignee change sends `assigned` to the new assignee.
- A status change to `done` or `cancelled` sends `status` to the assignee.

No rule notifies the actor. Unassigning an issue notifies nobody. Rows are keyed by receiver, so each
member sees only their own rows. `cycle` and `system` are render-only types; no current rule produces
them.

### 13.2 `GET /api/notifications`

Returns the rows of the calling member, newest first.

| Query | Default | Notes |
| --- | --- | --- |
| `limit` | `50` | Maximum number of rows |

Response `200`: `{ "items": [ { … } ] }`

The panel shows the newest 50 rows (`NOTIFICATION_LIMIT`). The unread badge uses
`GET /api/notifications/unread-count`, which returns `{ "count": n }` over **every** unread row
of the calling member (not just the 50-row panel window). Dexie uses the `memberId` index count.
The badge renders `99+` above 99.

### 13.2a `GET /api/notifications/unread-count`

Returns `{ "count": number }` for the calling member.

### 13.3 `POST /api/notifications/:id/read`

Marks one row as read. The `readAt` value does not change when the row is already read.

Response `200`: `{ "ok": true }`

Errors:

| Status | When |
| --- | --- |
| `404` | The id is unknown, or it belongs to another member |
| `405` | Method is not `POST` |

### 13.4 `POST /api/notifications/read-all`

Marks every unread row of the calling member as read. Other members keep their state.

Response `200`: `{ "ok": true }`

## 14. Admin

`GET /api/admin/*` requires an admin capability (`project:manage` OR `member:manage` OR
`workspace:manage`). `POST /api/admin/*` requires `workspace:manage`. Denials are `403
{ "error": "permission denied" }`.

| Endpoint | Response |
| --- | --- |
| `GET /api/admin/stats` | `{ projects, members, issues, done }` (soft-deleted rows excluded) |
| `GET /api/admin/workload` | `{ items: [{ memberId, total, todo, inProgress, done }] }` |
| `GET /api/admin/health` | `{ items: [{ projectId, name, total, overdue, unassigned, stale }] }` (stale = open and untouched for 14 days) |
| `GET /api/admin/export` | Backup envelope, see below |
| `POST /api/admin/import` | `{ ok: true }`; body `{ json: "<envelope as string>" }`, `400` on a bad envelope |
| `POST /api/admin/reset` | `{ ok: true }`; restores the deterministic seed |
| `POST /api/admin/wipe` | `{ ok: true }`; body `{ keepMemberId? }`; deletes all business rows |

Backup envelope (`version: 10`, 13 tables):

```json
{
  "app": "oas-pm",
  "version": 10,
  "exportedAt": 1700000000000,
  "tables": { "issues": [], "projects": [], "members": [], "comments": [],
              "savedViews": [], "activities": [], "settings": [], "cycles": [],
              "notifications": [], "roles": [], "audit": [], "projectRoles": [],
              "projectMembers": [] }
}
```

The export includes soft-deleted rows and keeps their `deletedAt` value. An import clears every table
and restores the envelope (trash included). If the envelope has no roles, the three built-in roles
are re-added so member roles never point at a missing row.

`wipe` keeps the built-in roles and the `keepMemberId` member (the web client passes the current
admin), so the admin console remains reachable after a wipe. It does **not** reseed on reload:
the Dexie seed marker is left in place. `reset` (and the settings page's "reset demo") clears the
marker and reseeds.

`reset` and `wipe` do not touch sessions. A session stays valid after a wipe. An admin can
therefore call `reset` again. A new login needs a member row, so wiping without `keepMemberId`
blocks new logins until `reset` runs. Deleting a member revokes that member's sessions (section 7).

## 15. Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Resource created |
| `204` | Success, no body (logout) |
| `400` | Malformed body, bad JSON, or a missing required field |
| `401` | Missing or invalid token, or bad credentials |
| `403` | Valid token, but the caller lacks the required action (admin capability, `workspace:manage`, or a write permission) |
| `404` | Unknown path or unknown resource |
| `405` | Wrong method for a known path |
| `409` | Conflict: duplicate project/member/role ID, duplicate project key, last admin, role still assigned or overridden, a project that still has issues, or a purge of a row that is not in the trash |
| `500` | Unexpected server error. The mock handler does not produce this code; uncaught errors surface as a Vite error. |

## 16. Client behavior

`src/data/api/client.ts` does the following for every request:

1. Reads the token from `src/data/api/session.ts` (`localStorage` key `oas-pm-token`).
2. Adds `Authorization: Bearer <token>`.
3. Turns any `status >= 400` into `ApiError { status, message }`.
4. On `401` with a token present: clears the token and emits `oas-pm-session-expired`.
   The app then shows the login page.
5. On `403`: emits `oas-pm-api-error`. The app shows a 6 second notice.

The list view shows an error block (`data-testid="list-error"`) when the first load fails. The
retry button subscribes again.

Both 401 and 403 notices are localized in the UI; the server messages are English and stable for
logs only.

## 17. Entity shapes

These are the row shapes (`src/types/index.ts`) returned by the API and stored in Dexie.

```ts
type Issue = {
  id: string
  projectId: string
  key: string                       // `${project.key}-${n}`
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assigneeId: string | null
  reporterId: string
  labels: string[]
  startAt: number | null
  dueAt: number | null
  createdAt: number
  updatedAt: number
  order: number
  parentId?: string | null          // one level of sub-issues
  completedAt?: number | null       // set when status becomes done
  relations?: Array<{ type: 'blocks' | 'blocked-by' | 'relates'; targetId: string }>
  cycleId?: string | null           // null/absent = no cycle
  deletedAt?: number | null         // null/absent = live; set = in trash
}

type Project = {
  id: string; name: string; key: string; description: string
  leadId: string; createdAt: number; nextKeyNum?: number
}

type Member = {
  id: string; name: string; email: string; avatarColor: string
  role: string                      // built-in id or custom role id
  title?: string; timezone?: string
}

type Cycle = {
  id: string; projectId: string; name: string
  startAt: number; endAt: number    // [startAt, endAt): now >= endAt means ended; UI-created cycles use the end of the chosen day
  goal?: string; createdAt: number; updatedAt: number
}

type Role = {
  id: string; name: string; description: string; builtin: boolean
  scope?: 'workspace' | 'project'
  permissions: string[]             // action ids from src/permission/policy.ts
}

type ProjectRoleAssignment = { id: string; projectId: string; memberId: string; roleId: string }
type ProjectMember = { id: string; projectId: string; memberId: string }
```

`Comment`, `SavedView`, `Activity`, `Notification`, `AuditEntry` and `SettingRow` follow
`src/types/index.ts` and `src/db/schema.ts`.

## 18. Local (Dexie) parity and verification

- The Dexie implementation (`src/data/dexie/*`) exposes the same Repository methods. Soft-delete,
  trash ordering and cascade behavior match this contract; the trash UI is gated by
  `workspace:manage`. The list window default is 200 in both sources.
- The local seed differs from the API seed by design: **local = 2 projects, 8 members, 3 cycles,
  2 saved views, 100,000 issues** (adjustable via `oas-pm-seed-size`, 1000–100000); **API mock =
  3 projects, 8 members, 3 cycles, 2,000 issues**. Both use seed `42` and the same saved-view
  definitions.
- Typecheck: `pnpm --filter pm exec tsc6 --noEmit` (the TS6 bin is `tsc6`, not `tsc`). Build:
  `pnpm --filter pm run build` (tsc6 + vite). Unit: `pnpm --filter pm run test` (309 tests).
  E2E: `pnpm --filter pm exec playwright test` (188 Chromium tests in 27 spec files, `workers: 1`).
  There is no mobile Playwright project and no size-budget script.
