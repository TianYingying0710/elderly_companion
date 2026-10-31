# Silver Companion Framework Acceptance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the existing Silver Companion foundation against its design using non-destructive commands, apply only minimal foundation fixes when justified, and publish an evidence-based acceptance report.

**Architecture:** Treat `docs/superpowers/specs/2026-10-17-silver-companion-foundation-design.md` as the source of truth for directory names and planned boundaries. Inspect first, run only tests supported by files that actually exist, isolate any database test data, and classify absent implementations as failures or unexecuted tests rather than creating the missing product framework.

**Tech Stack:** PowerShell, Vue 3, TypeScript, Vite, Python, FastAPI, SQLite.

**Spec:** `docs/superpowers/specs/2026-10-17-silver-companion-foundation-design.md`

## Global Constraints

- Perform inspection, testing, and only necessary basic-error fixes.
- Do not add business features, change the technology stack, rename planned directories, or refactor architecture.
- Do not delete, overwrite, or mutate existing user data or database files.
- Never report an unexecuted test as passed.
- Never report planned but absent functionality as implemented.

## Review Focus

- Empty or missing planned directories must be distinguished from complete components.
- Build and startup claims require real manifests, source files, and successful commands.
- Database checks must use a temporary path and must not modify repository data.
- Documentation must distinguish plans from completed work.
- Secrets must not be printed or inferred from absent configuration.

---

### Task 1: Inventory and acceptance baseline

**Files:**
- Read: `docs/superpowers/specs/2026-10-17-silver-companion-foundation-design.md`
- Create: `docs/framework-acceptance-report.md`

**Interfaces:**
- Consumes: planned repository structure and acceptance criteria from the design.
- Produces: an evidence-backed inventory and executable-test matrix.

- [ ] Enumerate all repository files, planned component paths, dependency manifests, environment examples, entry points, tests, scripts, and project documents.
- [ ] Record exact existence and non-empty checks for the three frontends, three backends, shared modules, and documentation.
- [ ] Run every build, import, startup, health, database, and automated-test command whose prerequisites exist; otherwise record the missing prerequisite and mark the test unexecuted.
- [ ] Investigate each observed failure before deciding whether it is a small foundation defect or missing implementation.
- [ ] Apply only isolated, minimal fixes supported by a reproducible failure, then rerun the affected verification.
- [ ] Write `docs/framework-acceptance-report.md` with commands, outputs, status, issues, fixes, unresolved items, completion assessment, and next steps.
- [ ] Re-run the final non-destructive verification matrix and confirm the report matches fresh evidence.
