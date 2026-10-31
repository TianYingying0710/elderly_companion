# Silver Companion Empty Framework Design

Date: 2026-10-17
Target directory: `E:\c2--\code`

## Purpose

Create a maintainable, independently runnable blank framework for the elder, guardian, and community products. This phase proves application boundaries, local startup, builds, and health checks only. It does not create databases, data, or production business behavior.

## Repository Structure

```text
code/
├── code1-elder/{frontend,backend}/
├── code2-guardian/{frontend,backend}/
├── code3-community/{frontend,backend}/
├── code4-shared/
├── docs/
├── scripts/
├── README.md
├── AGENTS.md
└── .gitignore
```

Each application owns its dependency configuration, environment example, entry point, and startup command. Applications never import one another's internal code. Backends may depend only on the stable contracts in `code4-shared`.

## Frontends

Each frontend uses Vue 3, TypeScript, and Vite. It provides a minimal landing page that identifies the product and displays its configured backend URL. Each project supports development startup, type checking, tests, production build, and preview. A small `apiRequest` wrapper reads `VITE_API_BASE_URL`; it does not call any business endpoint automatically.

Default ports are 5173 for elder, 5174 for guardian, and 5175 for community. Generated JavaScript, type declarations, TypeScript build metadata, dependencies, and build output must not pollute source control.

## Backends

Each backend is an independent FastAPI project with an application factory and `GET /health`. The endpoint returns only `status: ok` and its service identity. It must start without databases, API keys, external services, or network model calls.

Default ports are 8001 for elder, 8002 for guardian, and 8003 for community. CORS origins are environment-driven. FastAPI's generated OpenAPI documentation remains available.

## Shared Contracts

`code4-shared` contains only business-neutral contracts and reserved module locations:

- Health response contract.
- Data-access Protocol, marked pending.
- Community-knowledge retrieval Protocol, marked pending.
- Elder-memory read/write Protocol, marked pending.
- Language-model service Protocol, marked pending.
- Device gateway Protocol, marked pending.
- Empty public data-model package.

No interface has a concrete implementation or fabricated successful result. The shared package must not depend on any application.

## Data Prohibition

This phase must not create or include:

- SQLite or other database files.
- Schemas, tables, migrations, initialization, or seed scripts.
- Community records, addresses, phone numbers, procedures, or FAQs.
- Elder, guardian, binding, authorization, or help-event records.
- RAG corpora, vectors, elder memories, digital profiles, or datasets.
- Downloaded, scraped, or invented business data.

Database selection, schema design, data sourcing, cleaning, and import are explicitly deferred until the user approves a later data phase. A Python runtime may include its standard SQLite library; this is not a project database and no database operation is performed.

## Configuration and Security

Every application provides safe `.env.example` values. Real `.env` files, keys, dependencies, caches, virtual environments, builds, database files, and generated data are ignored. Missing future AI credentials cannot prevent startup.

## Verification

- Install frontend dependencies and run each frontend's unit test and production build.
- Start each Vite development server and verify its HTTP entry page.
- Install backend dependencies into the user-approved environment at `E:\workspace\silver-companion-env`.
- Run shared-contract and backend health tests.
- Start each Uvicorn server and verify `GET /health` over HTTP.
- Scan the repository for forbidden database, migration, seed, and business-data artifacts.
- Record actual commands and outcomes in `docs/framework-acceptance-report.md`.

No unexecuted test is reported as passed.

## Deferred Scope

Authentication, authorization, notifications, care workflows, polished UI, database work, data collection, RAG ingestion, model calls, device integration, and deployment are future phases.
