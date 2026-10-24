# Accessibility audit — pm template

Audit date: 2026-10-23. Template: `templates/pm`. Status: **pass with documented leftovers**.

This document reports a structured accessibility (a11y) audit of the pm template.
It lists the scope, the method, the result for each check and each view, the items that were
fixed, and the items that remain open.

## 1. Scope

Views audited (9), each in the light and the dark theme (18 audits):

| View | Entry point | Data |
| --- | --- | --- |
| list | `view-seg` = 列表 | seeded 5,000 issues |
| board | `view-seg` = 看板 | same |
| timeline | `view-seg` = 时间线 | same |
| resource | `view-seg` = 资源 | same |
| schedule | `view-seg` = 日程 | same |
| dashboard | `view-seg` = 仪表盘 | same |
| admin | `pm-toolbar` → `admin-entry` | same |
| drawer | click on the first issue row | same |
| login | API mode (`localStorage oas-pm-data = api`), no token | mock backend |

The audit also covers the Tab order (login page, workbench list, detail drawer) and the
`prefers-reduced-motion` behaviour.

The audit does not cover: screen reader output on real AT, zoom and reflow, text spacing,
form validation announcements, and the printed page.

## 2. Method

The audit is a Playwright spec: `e2e/a11y.spec.ts`. It adds no dependency.

1. **Contrast.** The spec walks every text node in the page, including the nodes inside shadow
   roots and the nodes assigned to slots. For each node it reads the computed text color and
   composes the background of the flat-tree ancestors (shadow host, slot, parent chain). It then
   computes the WCAG 2.1 relative-luminance ratio. The threshold is 4.5:1 for normal text and
   3:1 for large text (≥ 24 px, or ≥ 18.66 px when bold). Nodes with a background image or a
   `background-clip: text` are counted but skipped: 18 nodes in total.
2. **Semantics and accessible names.** The spec takes `locator.ariaSnapshot()`. Playwright
   computes accessible names with the ARIA algorithm, and it pierces shadow DOM and slots.
   The spec reports every interactive role that has no name, and it reports the landmarks and
   the level-1 headings.
3. **Focus.** The spec presses Tab. For each stop it resolves the deep active element and
   checks that a focus indicator is visible on the element or on its shadow host.
4. **Motion.** The spec emulates `prefers-reduced-motion: reduce` and lists every element
   (shadow included) that still has a running animation or a transition longer than 20 ms.

Run it with:

```bash
pnpm --filter pm exec playwright test a11y.spec.ts
A11Y_OUT=/tmp/a11y.json pnpm --filter pm exec playwright test a11y.spec.ts   # dump raw data
```

Same suite on Firefox: `PW_BROWSER=firefox`. It passes on Firefox too.

## 3. Results

Legend: **pass** = the check found no violation. **fixed** = the audit found a violation and the
fix is in this change. **leftover** = the finding comes from a component in the upstream
`@oas-ui/ui` package, which this template cannot change.

### 3.1 Check × view

| Check | list | board | timeline | resource | schedule | dashboard | admin | drawer | login |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Contrast, light | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed |
| Contrast, dark | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed | pass |
| Landmarks (`banner` / `main` / `navigation`) | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed |
| Level-1 heading | pass | fixed | fixed | fixed | fixed | pass | pass | pass | pass |
| Button and link names | fixed | fixed | fixed | fixed | fixed | fixed | fixed | fixed | pass |
| Form control names | fixed | pass | pass | pass | pass | pass | pass | fixed | pass |
| Tab order and focus indicator | — | — | — | — | — | — | — | fixed | pass |
| `prefers-reduced-motion` | pass | — | — | — | — | pass | — | — | pass |

### 3.2 Counts

| Item | Before | After |
| --- | --- | --- |
| Text nodes measured (18 audits) | — | 2,491 |
| Groups below the contrast threshold | 46 | **0** |
| Interactive nodes without an accessible name | 118 | **18** (all component-owned, see 5) |

The 18 remaining unnamed nodes are: `tablist` × 14, `table` × 2, `radiogroup` × 2.
All three come from upstream components.

## 4. Fixed items

### 4.1 Contrast

1. `src/styles/app.css` — the app tokens for status and priority moved to the 700 weight:
   `--pm-status-backlog` `#9aa3b8` → `#64748b` (2.53 → 4.76),
   `--pm-status-in-progress` and `--pm-priority-high` `#d97706` → `#b45309` (3.19 → 5.02),
   `--pm-status-done` `#059669` → `#047857` (3.77 → 5.48).
   These tokens color small text (11–12 px) in the list, board, drawer, schedule and dashboard.
2. `src/styles/app.css` — the dark theme uses `#74b1ff` for status `todo` and priority `medium`.
   The upstream preset blue gave 3.49:1 on the dark card surface `#3f3f46`.
3. `src/styles/app.css` — hint text stopped using the disabled token. The audit found 4.4:1 and
   2.56:1 cases. Changed selectors: `.issue-toolbar-label`, `.dash-note`, `.detail-dates`,
   `.detail-desc-block > span`, `.detail-labels-block > span`, `.comments-block > span`,
   `.comment-meta`, `.user-pick-role`, `.activities-block > span`, `.activity-time`,
   `.notify-time`, `.sub-item .sub-done`, `.detail-meta > div > span`, `.tb-source`.
4. `src/styles/app.css` — `.schedule-page oas-scheduler` overrides
   `--oas-color-text-disabled` with the secondary text token. The component draws the
   "not this month" day numbers with the disabled color (2.56:1). The template cannot change the
   rule inside the shadow root, but it can change the variable that the rule reads (now 4.83:1).
5. `src/lib/colors.ts` — new `AVATAR_PALETTE` with 700-weight colors, and `AVATAR_UNASSIGNED`
   (`#52525b`). The upstream avatar picks white or dark text from the luminance of the color and
   uses 0.35 as the switch point. Colors between 0.175 and 0.35 luminance fail with both text
   colors, so the palette must avoid them. The palette is used by `seed-db.ts`, `mock-server.ts`
   and the member editor in `MembersTab.tsx`. The unassigned avatar was white on `#d4d4d8`
   (1.48:1).

### 4.2 Names and semantics

6. `src/App.tsx` — `command-open` is an icon-only button. It now has an `aria-label`.
7. `src/components/oas-wrappers.tsx` — `OSelect` writes the `label` attribute. `oas-select`
   copies that attribute to the `aria-label` of the inner combobox and falls back to the
   placeholder. Before this change, three toolbar selects and six drawer selects were all named
   "请选择" / the placeholder text. `OTabs` now takes `ariaLabel`.
8. `src/views/list/IssueListView.tsx`, `src/views/issue/IssueDetailDrawer.tsx` — the selects pass
   a real label: sort, group, priority, status, assignee, cycle, relation type, relation target.
9. `src/components/oas-wrappers.tsx` and `src/views/list/VirtualIssueList.tsx` — every row
   checkbox gets a name ("选择 OAS-5000" / "Select OAS-5000"). The name is slotted text, hidden
   with inline styles because the rows live in a shadow root. Before this change the list exposed
   up to 21 unnamed checkboxes per window.
10. `src/views/admin/AdminView.tsx`, `src/views/auth/LoginView.tsx` — the admin content and the
    login card are now `<main>`. The admin view and the login page had no main landmark.
11. `src/views/resource/ResourceView.tsx`, `src/views/schedule/ScheduleView.tsx` — the view title
    changed from `<span>` to `<h1>` (the class keeps the look). `src/views/board/KanbanBoard.tsx`
    and `src/views/timeline/TimelineView.tsx` have no visible title, so they get a visually
    hidden `<h1 class="sr-only">`. Before this change, four views had no level-1 heading.

### 4.3 Motion and focus

12. `src/styles/app.css` — no `animation` or `transition` rule exists, so the app needs no
    `prefers-reduced-motion` block. The audit confirms zero animated nodes under
    `reduce` (A11). The spec asserts this, so a later animation must ship with its downgrade.
13. Focus indicators were already present. The audit found no tab stop without a visible
    indicator on the login page, the workbench list or the detail drawer. The key path
    (Tab to a row, Enter, drawer) moves the focus into the drawer (A10b).

## 5. Leftover items

These items need a change in `@oas-ui/ui`. The template cannot fix them, and the audit allows
them by role name (see `KNOWN_UNNAMED` in `e2e/a11y.spec.ts`). They are not hidden:

| Item | Cause | Suggested upstream change |
| --- | --- | --- |
| `tablist` has no name (view switcher, 14 audits) | `oas-tabs` builds `role="tablist"` inside its shadow root and does not forward the host `aria-label` | read a `label` attribute on the host, as `oas-select` already does |
| `table` has no name (admin, 2 audits) | `oas-table` renders `<table>` inside its shadow root without `caption` or `aria-label` | add a `label` attribute and write it to `aria-label` of the table |
| `radiogroup` has no name (drawer, 2 audits) | `oas-segmented` builds `role="radiogroup"` inside its shadow root and does not forward the host `aria-label` | same as `oas-tabs` |

Other known gaps, not measured by the current spec:

- `oas-avatar` chooses the text color from the luminance of the background with a fixed 0.35
  switch point. Mid-tone colors still fail with both text colors. The template avoids them in its
  palette. The component should compare the two contrast ratios.
- The row is `role="button"` and contains a checkbox. Nesting is not ideal for AT. A row with
  `role="row"` plus a real grid is a larger change and is out of scope here.
- `oas-empty` and `oas-skeleton` take a `title` attribute. The rendered text is the accessible
  name in the current build; the audit did not find a gap, but a regression there would be silent.

## 6. Limits of this audit

- The contrast engine reads computed colors. A background that comes from an image or a gradient
  is skipped (18 nodes). None of them carries text that the audit could not reach otherwise.
- The name check uses Playwright's ARIA implementation, not a screen reader.
- The audit samples one window of the list (about 21 rows) and the first open drawer. It does
  not walk all 5,000 rows.
- The audit runs in Chromium unless `PW_BROWSER=firefox` is set. Both runs pass.
