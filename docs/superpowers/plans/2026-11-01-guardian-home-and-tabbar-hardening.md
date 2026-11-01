
# Guardian Home and TabBar Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace page-recreating guardian navigation with a real WeChat tabBar and make the home health trend an honest, bounded heart-rate demo ready for a future hardware data source.

**Architecture:** `pages.json` owns the four tab routes; one WeChat-native `custom-tab-bar` renders them and calls `wx.switchTab`, so pages no longer embed a Vue navigation copy. Home trend semantics live in a pure domain module while the page only renders and draws the ViewModel.

**Tech Stack:** uni-app Vue 3, TypeScript, WeChat custom tabBar (`wxml/wxss/js`), Vitest, canvas 2D

**Spec:** `docs/superpowers/specs/2026-11-01-guardian-home-and-tabbar-hardening-design.md`

## Global Constraints

- Do not install, update, or remove dependencies.
- Do not modify `code2-guardian/backend` or any other application.
- Do not add hardware SDKs, database code, real health data, authentication, notifications, or device behavior.
- AI advice cards and the profile menu remain unchanged this round.
- All displayed names and health values remain explicitly fictional demo content.
- Use tests first; build only after focused tests and type checking pass.
- Do not commit `.env`, `dist`, tokens, AppID values, databases, or tool configuration.

## Review Focus

- Rapid repeated tab taps must not launch overlapping switches; the lock must always clear on success or failure.
- Tapping the selected tab must provide pressed feedback without calling `switchTab` again.
- Custom tab selection must synchronize on every page `onShow`, including direct launch into a non-home tab.
- Canvas drawing must handle an empty or flat series without division by zero or drawing outside its plot bounds.
- Safe-area padding must remain visible but must not create a misleading dead target below the actual tab buttons.

---

### Task 1: Real custom tabBar routing

**Files:**
- Create: `code2-guardian/frontend/src/domain/tabs.ts`
- Create: `code2-guardian/frontend/src/domain/tabs.spec.ts`
- Create: `code2-guardian/frontend/src/custom-tab-bar/index.json`
- Create: `code2-guardian/frontend/src/custom-tab-bar/index.wxml`
- Create: `code2-guardian/frontend/src/custom-tab-bar/index.wxss`
- Create: `code2-guardian/frontend/src/custom-tab-bar/index.js`
- Create: `code2-guardian/frontend/src/static/tabbar/*.svg`
- Modify: `code2-guardian/frontend/src/pages.json`
- Modify: all four files under `code2-guardian/frontend/src/pages/*/index.vue`
- Delete: `code2-guardian/frontend/src/components/TabBar.vue`
- Modify: `code2-guardian/frontend/src/App.spec.ts`

**Interfaces:**
- Produces: `TAB_ITEMS` with exact keys `home | advice | messages | profile`, exact page paths, labels, and local icon paths.
- Produces: native custom-tab-bar `switchTab(event)` and `syncSelected()` behavior backed by the same ordered route contract asserted in tests.

- [ ] **Step 1: Add failing route-contract tests**

Assert `TAB_ITEMS` contains the four unique absolute paths in UI order; `pages.json` declares the same pages under `tabBar.list` with `custom: true`; each page source no longer imports or renders the Vue `TabBar`; and `src/custom-tab-bar` contains all four native component files.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/domain/tabs.spec.ts src/App.spec.ts`

Expected: FAIL because `tabs.ts`, the tabBar configuration, and native component do not exist.

- [ ] **Step 3: Implement the route contract and native custom tabBar**

Add `TAB_ITEMS`; register all four pages in `pages.json.tabBar.list` with `custom: true`; add native component files that use `wx.switchTab`, a single in-flight lock, `success/fail/complete`, pressed state, selected-tab no-op, and `wx.showToast` on failure. Give each item a minimum 88rpx touch height above the safe area and use local SVG assets derived from the existing placeholder icon set.

- [ ] **Step 4: Synchronize selected state without page-local route copies**

On each page `onShow`, call the native tab bar instance's `syncSelected()`; remove the Vue `TabBar` import/render from all four pages. Keep message filter state module-local so the retained Tab page preserves it.

- [ ] **Step 5: Run focused tests and build proof**

Run: `npm test -- src/domain/tabs.spec.ts src/App.spec.ts`

Run: `npm run type-check`

Run: `npm run build:mp-weixin`

Expected: tests PASS; type check exit 0; generated `app.json` contains `tabBar.custom=true`; generated `custom-tab-bar` files exist.

### Task 2: Stable heart-rate trend ViewModel

**Files:**
- Create: `code2-guardian/frontend/src/domain/healthTrend.ts`
- Create: `code2-guardian/frontend/src/domain/healthTrend.spec.ts`
- Modify: `code2-guardian/frontend/src/types/index.ts`
- Modify: `code2-guardian/frontend/src/mock/data.ts`
- Modify: `code2-guardian/frontend/src/pages/index/index.vue`
- Modify: `code2-guardian/frontend/src/App.spec.ts`

**Interfaces:**
- Produces: `HeartRateTrendPoint { dateLabel: string; value: number }`.
- Produces: `heartRateTrend: HeartRateTrendPoint[]` containing exactly seven explicitly fictional daily-average resting-heart-rate points.
- Produces: pure `buildTrendPoints(values, width, height, padding)` coordinates constrained to the plot rectangle, including empty and flat-series handling.

- [ ] **Step 1: Add failing semantic and geometry tests**

Assert seven valid date labels and plausible demo heart-rate values; title/metric/unit copy is `近7天健康趋势`, `每日平均静息心率`, `次/分`; generated points remain inside padding for normal and flat series; empty input returns an empty array; home source contains `演示数据` and no `trend-bell`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/domain/healthTrend.spec.ts src/App.spec.ts`

Expected: FAIL because the ViewModel and bounded geometry do not exist and the bell is still rendered.

- [ ] **Step 3: Implement the pure ViewModel and canvas geometry**

Move trend semantics out of the page/mock numeric array into typed points. Use explicit canvas width and height from selector measurement, DPR scaling, `ctx.clearRect`, bounded plot padding, and clipping so strokes and fills cannot overlap the header.

- [ ] **Step 4: Implement the approved trend presentation**

Keep the detail chevron; add demo badge, metric label, unit, and seven date labels; remove the yellow bell; preserve the current card visual language without adding metric switching or hardware behavior.

- [ ] **Step 5: Run focused proof**

Run: `npm test -- src/domain/healthTrend.spec.ts src/App.spec.ts`

Run: `npm run type-check`

Expected: PASS and exit 0.

### Task 3: Honest home-page planned entrances

**Files:**
- Modify: `code2-guardian/frontend/src/pages/index/index.vue`
- Modify: `code2-guardian/frontend/src/App.spec.ts`

**Interfaces:**
- Consumes: Task 2 trend presentation.
- Produces: `showPlannedFeature()` with the exact toast `功能建设中` and no state mutation.

- [ ] **Step 1: Add failing home-boundary tests**

Assert health summary and trend show the demo marker; elder card, trend header, and reminders header call `showPlannedFeature`; reminder rows no longer contain the empty completion circle; AI and profile sources remain byte-for-byte outside this task except Task 1 navigation removal/onShow synchronization.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/App.spec.ts`

Expected: FAIL because planned entrances are silent and reminder circles remain.

- [ ] **Step 3: Implement minimal honest feedback**

Bind only the three approved home entrances to `uni.showToast({ title: '功能建设中', icon: 'none' })`; remove reminder circles; do not create detail pages or change reminder data.

- [ ] **Step 4: Run focused proof**

Run: `npm test -- src/App.spec.ts`

Run: `npm run type-check`

Expected: PASS and exit 0.

### Task 4: Delivery verification

**Files:**
- Modify only if results are stale: `docs/progress.md`

**Interfaces:**
- Consumes: Tasks 1–3 completed tree.
- Produces: verified guardian mini-program build with an honest record of automated and manual evidence.

- [ ] **Step 1: Run the complete guardian frontend suite**

Run: `npm test`

Run: `npm run type-check`

Run: `npm run build:mp-weixin`

Expected: all tests PASS; type check and build exit 0.

- [ ] **Step 2: Inspect generated delivery artifacts**

Verify generated `app.json` contains the four Tab pages and `custom: true`; generated `custom-tab-bar` files and local icons exist; no `.env`, AppID, token, database, or test credential appears in the output.

- [ ] **Step 3: Verify in WeChat DevTools**

Import `code2-guardian/frontend/dist/build/mp-weixin`; test first and repeat Tab switches, selected-tab tap, rapid taps, message-filter retention, safe-area hit targets, planned-feature toast, and trend bounds. Mark unavailable or blocked honestly if the tool cannot be controlled.

- [ ] **Step 4: Run repository integrity checks**

Run from repository root: `git diff --check`, `git status --short --branch`, and inspect `git diff -- code2-guardian/frontend docs`.

Expected: only approved guardian frontend, spec, plan, and necessary progress documentation changes; no dependency, backend, generated artifact, or recovery-directory changes.
