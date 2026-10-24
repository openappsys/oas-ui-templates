# PM REST API contract

This document describes the HTTP API of the PM template. The mock server in
`src/data/api/mock-server.ts` implements this contract. The Vite dev server mounts the mock at
`/api` (`vite.config.ts`). The React client in `src/data/api/client.ts` consumes it.

The API is a demo backend. It keeps all data in memory. It does not persist data. It resets the
data when the dev server restarts.

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

| Rule | Effect |
| --- | --- |
| Any valid token | Read every resource, write issues, comments, activities, saved views and cycles, and mark own notifications read |
| `role = "admin"` only | All `/api/admin/*` endpoints, `POST/PATCH/DELETE /api/projects*`, `POST/PATCH/DELETE /api/members*`, `POST/PATCH/DELETE /api/roles*`, `PUT /api/settings/:key` |
| No token | `401` |

A valid token with a non-admin role on an admin-only endpoint returns `403` with
`{ "error": "admin role required" }`. The frontend also hides these actions with its client-side
policy (`src/permission/policy.ts`). The server check is the authority.

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

- `limit` defaults to the list window (500) on window queries.
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
| `limit` | number | Window size |

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

Deleted rows are excluded from every query: the list window, `search`, counts, sub-issues,
relation candidates, created-since, workload, cycle counts, cycle issues, `bulk`, `all`, and the
dashboard/admin requests. `GET /api/issues/:id` returns `404` for a deleted row.

### 5.6.1 Trash endpoints

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/issues?deleted=1` | `{ items }` | Trash list. Sorted by `deletedAt` descending, then by ID descending. Admin-only. |
| `POST /api/issues/:id/restore` | `{ ok: true }` | Clears `deletedAt`. Admin-only. A row that is not deleted is a no-op. `404` for an unknown ID. |
| `DELETE /api/issues/:id/purge` | `{ ok: true }` | Physical delete. Admin-only. `409` when the row is not in the trash. `404` for an unknown ID. |

### 5.7 `GET /api/issues/:id/sub-issues`

Response `200`: `{ "items": [Issue, …] }` (children by `parentId`, ID ascending).

### 5.8 Issue helper endpoints

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/issues/all?limit=` | `{ items }` | All issues, ID ascending, limited |
| `GET /api/issues/bulk?ids=a,b` | `{ items: [Issue \| null] }` | Positional result; `null` for unknown IDs |
| `GET /api/issues/counts?projectId=` | `{ total, byStatus: { todo, in_progress, … } }` | Counts over the whole project |
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

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/projects` | – | `{ items }` (ID ascending) | – |
| `POST /api/projects` | Project object | `201 { ok: true }` | `409` duplicate ID |
| `GET /api/projects/:id` | – | `{ project }` | `404` |
| `PATCH /api/projects/:id` | `{ changes }` | `{ ok: true }` | `404` |
| `DELETE /api/projects/:id` | – | `{ ok: true }` | `404`, `409` project still has issues |
| `POST /api/projects/:id/allocate-key` | – | `{ keyNum }` | – |

The `allocate-key` call increases `nextKeyNum` by one and returns the used number.

## 7. Members

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/members` | – | `{ items }` (ID ascending) | – |
| `POST /api/members` | Member object | `201 { ok: true }` | `409` duplicate ID |
| `GET /api/members/:id` | – | `{ member }` | `404` |
| `PATCH /api/members/:id` | `{ changes }` | `{ ok: true }` | `400` unknown role, `404`, `409` demoting the last admin |
| `DELETE /api/members/:id` | – | `{ ok: true }` | `409` removing the last admin |

`DELETE` also clears the deleted member from every issue assignee. The call is idempotent: an
unknown ID returns `{ "ok": true }`.

## 7b. Roles

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/roles` | – | `{ items }` (ID ascending; built-in + custom) | – |
| `POST /api/roles` | Role object (`id, name, description, permissions`) | `201 { ok: true }` | `400` missing id/name, `409` duplicate ID |
| `PATCH /api/roles/:id` | `{ changes }` | `{ ok: true }` | `403` built-in role, `404` |
| `DELETE /api/roles/:id` | – | `{ ok: true }` | `403` built-in role, `404`, `409` role assigned to members |

`permissions` is an array of action ids from `src/permission/policy.ts`. Built-in roles
(`admin`, `member`, `viewer`) are read-only; custom roles grant permissions unconditionally.
Member assignment uses `PATCH /api/members/:id { changes: { role: "<role id>" } }`.
Writes require an admin token.

## 8. Comments

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/comments?issueId=` | – | `{ items }` created-at ascending | – |
| `POST /api/comments` | `{ issueId, authorId, body }` | `201 { comment }` | – |
| `PATCH /api/comments/:id` | `{ body }` | `{ ok: true }` | `404` |
| `DELETE /api/comments/:id` | – | `{ ok: true }` | `404` |

## 9. Activities

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/activities?issueId=` | – | `{ items }` created-at descending | – |
| `GET /api/activities?recent=<n>` | – | `{ items }`, newest `n`, default 100 | – |
| `POST /api/activities` | `{ issueId, actorId, type, field?, from?, to? }` | `201 { ok: true }` | – |

`issueId` wins over `recent` when both are present.

## 10. Saved views

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/saved-views` | – | `{ items }` (name ascending) | – |
| `POST /api/saved-views` | `{ name, filters }` | `201 { ok: true }` | – |
| `DELETE /api/saved-views/:id` | – | `{ ok: true }` | – |

The server stores `filters` as a JSON string. The client parses it on read.

## 11. Cycles

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/cycles?projectId=` | project ID, `__all__`, or omitted (all) | `{ items }` start-at descending | – |
| `POST /api/cycles` | `{ projectId, name, startAt, endAt, goal? }` | `201 { cycle }` | – |
| `GET /api/cycles/:id` | – | `{ cycle }` | `404` |
| `PATCH /api/cycles/:id` | `{ changes }` | `{ ok: true }` | `404` |
| `DELETE /api/cycles/:id` | – | `{ ok: true }` | `404` |

`DELETE` does not delete issues. It sets their `cycleId` to `null` and updates `updatedAt`.

## 12. Settings

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/settings/:key` | – | `{ found: boolean, value }` | – |
| `PUT /api/settings/:key` | `{ value }` | `{ ok: true }` | – |

`GET` never returns `404`. A missing key returns `{ "found": false, "value": null }`. `PUT` is
admin-only.

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
member sees only their own rows.

### 13.2 `GET /api/notifications`

Returns the rows of the calling member, newest first.

| Query | Default | Notes |
| --- | --- | --- |
| `limit` | `50` | Maximum number of rows |

Response `200`: `{ "items": [ { … } ] }`

The client derives the unread badge from this list (the newest 50 rows).

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

All admin endpoints are admin-only. A non-admin token gets `403`.

| Endpoint | Response |
| --- | --- |
| `GET /api/admin/stats` | `{ projects, members, issues, done }` |
| `GET /api/admin/workload` | `{ items: [{ memberId, total, todo, inProgress, done }] }` |
| `GET /api/admin/health` | `{ items: [{ projectId, name, total, overdue, unassigned, stale }] }` |
| `GET /api/admin/export` | Backup envelope, see below |
| `POST /api/admin/import` | `{ ok: true }`; body `{ json: "<envelope as string>" }`, `400` on a bad envelope |
| `POST /api/admin/reset` | `{ ok: true }`; restores the deterministic seed |
| `POST /api/admin/wipe` | `{ ok: true }`; deletes all rows |

Backup envelope:

```json
{
  "app": "oas-pm",
  "version": 9,
  "exportedAt": 1700000000000,
  "tables": { "issues": [], "projects": [], "members": [], "comments": [],
              "savedViews": [], "activities": [], "settings": [], "cycles": [],
              "notifications": [] }
}
```

The export includes soft-deleted rows and keeps their `deletedAt` value. An import restores
the trash together with the live rows.

`reset` and `wipe` do not touch sessions. A session stays valid after a wipe. An admin can
therefore call `reset` again. A new login needs a member row, so `wipe` blocks new logins until
`reset` runs.

## 15. Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Resource created |
| `204` | Success, no body (logout) |
| `400` | Malformed body, bad JSON, or a missing required field |
| `401` | Missing or invalid token, or bad credentials |
| `403` | Valid token, but the endpoint needs the admin role |
| `404` | Unknown path or unknown resource |
| `405` | Wrong method for a known path |
| `409` | Conflict: duplicate ID, last admin, a project that still has issues, or a purge of a row that is not in the trash |
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
