# Mobile Client Platforms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the repository from machine-specific tooling, retain the elder Capacitor Android client, and convert the guardian and community skeletons into independently buildable WeChat mini programs.

**Architecture:** Source stays in the monorepo while Python, Android, Gradle, emulator, and package caches remain external. The elder client keeps its Vue-to-Capacitor boundary; guardian and community become separate uni-app applications whose generated `mp-weixin` directories are opened in WeChat Developer Tools.

**Tech Stack:** PowerShell, Python/FastAPI, Vue 3, TypeScript, Vite, Capacitor 8, uni-app, Vitest, WeChat Mini Program.

**Spec:** `docs/superpowers/specs/2026-10-24-mobile-client-platforms-design.md`

## Global Constraints

- Do not create databases, datasets, migrations, seed scripts, or business records.
- Do not implement business functionality.
- Do not commit secrets, `.env`, `node_modules`, build output, virtual environments, SDKs, Gradle caches, or private WeChat AppID configuration.
- Preserve three independent applications and three independent backend entry points.
- Do not change the backend technology stack or the elder Vue/Capacitor approach.

## Review Focus

- Scripts must work when the repository and Python environment live at paths other than the author's machine paths.
- Tests must not change behavior based on ignored `.env.local` files.
- Mini-program API base URLs must distinguish developer-tool, device, and production access.
- Generated mini-program output and private AppID files must remain untracked.
- Existing backend and shared-contract tests must remain green.

---

### Task 1: Environment resolution

**Files:**
- Create: `scripts/resolve-python.ps1`
- Create: `scripts/tests/test-environment-scripts.ps1`
- Modify: `scripts/install-backend-dependencies.ps1`
- Modify: `scripts/start-elder-backend.ps1`
- Modify: `scripts/start-guardian-backend.ps1`
- Modify: `scripts/start-community-backend.ps1`
- Modify: `scripts/verify-framework.ps1`
- Modify: `README.md`

**Interfaces:**
- Produces: `Resolve-SilverCompanionPython([string] $ExplicitPython) -> string`
- Precedence: explicit parameter, `SILVER_COMPANION_PYTHON`, active `python` on PATH.

- [ ] Write script tests for explicit, environment, PATH, and missing-interpreter behavior.
- [ ] Run tests and verify they fail before the resolver exists.
- [ ] Implement the resolver and update scripts to consume it.
- [ ] Run script tests, backend tests, and shared-contract tests.
- [ ] Commit `chore: decouple backend scripts from local paths`.

### Task 2: Elder Android verification

**Files:**
- Modify: `code1-elder/frontend/package.json`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: external `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `GRADLE_USER_HOME`.
- Produces: documented Web build, Capacitor sync, and Android Debug build commands.

- [ ] Add a verification script entry without embedding SDK paths.
- [ ] Run elder tests and production build.
- [ ] Run Capacitor sync.
- [ ] Run Android Debug build using external tools.
- [ ] Commit `chore: verify elder android toolchain boundary`.

### Task 3: Guardian WeChat mini program

**Files:**
- Replace guardian frontend Web scaffold with uni-app Vue 3 TypeScript configuration.
- Create: `code2-guardian/frontend/src/pages/index/index.vue`
- Create: `code2-guardian/frontend/src/api/client.ts`
- Create: `code2-guardian/frontend/pages.json`
- Create: `code2-guardian/frontend/manifest.json`
- Test: `code2-guardian/frontend/src/api/client.spec.ts`

**Interfaces:**
- Produces: `apiRequest<T>(path: string, options?) -> Promise<T>` backed by `uni.request`.
- Produces: `dist/dev/mp-weixin` and `dist/build/mp-weixin` outputs.

- [ ] Write failing tests for base URL composition and failed requests.
- [ ] Implement the minimal uni-app request wrapper.
- [ ] Add a minimal role-identifying page with no business functions.
- [ ] Run tests, type checking, and the `mp-weixin` production build.
- [ ] Commit `feat: migrate guardian shell to wechat mini program`.

### Task 4: Community WeChat mini program

**Files:**
- Replace community frontend Web scaffold with independent uni-app Vue 3 TypeScript configuration.
- Create: `code3-community/frontend/src/pages/index/index.vue`
- Create: `code3-community/frontend/src/api/client.ts`
- Create: `code3-community/frontend/pages.json`
- Create: `code3-community/frontend/manifest.json`
- Test: `code3-community/frontend/src/api/client.spec.ts`

**Interfaces:**
- Mirrors the guardian interface contract without importing guardian source.

- [ ] Write failing tests for the community API wrapper.
- [ ] Implement the minimal independent uni-app shell.
- [ ] Run tests, type checking, and the `mp-weixin` production build.
- [ ] Verify no cross-application source imports.
- [ ] Commit `feat: migrate community shell to wechat mini program`.

### Task 5: Unified verification and documentation

**Files:**
- Modify: `scripts/verify-framework.ps1`
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/api.md`
- Modify: `docs/progress.md`
- Modify: `docs/framework-acceptance-report.md`

**Interfaces:**
- Produces: one framework verification entry point covering all three frontends, all three backends, and shared contracts.

- [ ] Update verification expectations for Android and two `mp-weixin` targets.
- [ ] Run all frontend tests and builds.
- [ ] Run all backend and shared tests.
- [ ] Scan for secrets, databases, generated data, committed build output, and forbidden cross-imports.
- [ ] Update documentation with actual results only.
- [ ] Commit `docs: record mobile platform migration verification`.

