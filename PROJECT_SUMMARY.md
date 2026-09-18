# GridWise LLM — Project Summary

## 🎯 Overview

**GridWise** is an LLM-powered campus energy optimization engine built for the **BUP CSE Fest 2026 Hackathon**. It accepts a 24-hour energy scenario with natural-language operator notes, interprets them using AI, and produces an optimized electricity schedule that minimizes cost while respecting all constraints.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Fastify HTTP Server                      │
│                     (Port 3000)                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /optimize-energy                                       │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Request    │───▶│  LLM        │───▶│  Guardrails │      │
│  │   Validation │    │  Interpreter│    │  Validator  │      │
│  │   (Zod)      │    │  (Mistral)  │    │  (Zod)      │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                  │                   │              │
│         ▼                  ▼                   ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Shared     │    │  Determinis │    │  Math        │      │
│  │  Types      │    │  tic Fallback│   │  Optimizer   │      │
│  │  (Zod)      │    │  (Regex)    │    │  (LP Solver) │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────┐           │
│                                    │  Schedule   │           │
│                                    │  Validator  │           │
│                                    └─────────────┘           │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────┐           │
│                                    │  API        │           │
│                                    │  Response   │           │
│                                    └─────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Monorepo Structure

```
orizon/
├── packages/
│   ├── shared-types/          # TypeScript types + Zod schemas
│   │   └── src/index.ts       # 110 lines
│   │
│   ├── llm-interpreter/       # Mistral API + fallback parser
│   │   └── src/index.ts       # 309 lines
│   │
│   ├── guardrails/            # Directive validation
│   │   └── src/index.ts       # 139 lines
│   │
│   ├── optimizer/             # LP solver (Linear Programming)
│   │   └── src/index.ts       # 251 lines
│   │
│   ├── schedule-validator/    # Final schedule validation
│   │   └── src/index.ts       # 212 lines
│   │
│   └── api/                   # Fastify HTTP server
│       └── src/
│           ├── app.ts         # 109 lines (routes + logic)
│           ├── server.ts      # 13 lines (entry point)
│           └── ui.ts          # 355 lines (dashboard UI)
│
├── test/
│   ├── e2e/
│   │   └── public-samples.test.ts   # E2E tests (10 cases)
│   └── unit/
│       ├── guardrails.test.ts
│       ├── optimizer.test.ts
│       └── schedule-validator.test.ts
│
├── problem_doc/               # Challenge documentation
│   ├── BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json
│   ├── BUP_CSE_FEST_2026_Preliminary_Problem_Statement_GridWise_LLM.pdf
│   ├── BUP_CSE_FEST_2026_Participant_Guide_&_Evaluation_Rubric_GridWise_LLM.pdf
│   └── SAMPLE_TEST_RESULTS.md
│
├── .env.example               # Environment template
├── .env.local                 # Secrets (git-ignored)
├── .gitignore                 # Git ignore rules
├── package.json               # Root monorepo config
├── tsconfig.json              # TypeScript config
├── README.md                  # Project documentation
├── PROJECT_SUMMARY.md         # This file
└── REQUIREMENTS_CHECK.md      # Requirements audit
```

**Total Source Code:** 1,124 lines TypeScript

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | TypeScript | Type safety + modern JS |
| **Runtime** | Node.js v26 | Server runtime |
| **HTTP Server** | Fastify v5 | High-performance HTTP |
| **LLM** | Mistral AI | Natural language interpretation |
| **Math Solver** | javascript-lp-solver | Linear Programming optimization |
| **Validation** | Zod | Request/response schema validation |
| **Testing** | Vitest | Unit + E2E testing |
| **Build** | TypeScript Compiler | Compilation |
| **Package Manager** | npm workspaces | Monorepo management |

---

## 🔌 API Endpoints

### `GET /health`

**Response:**
```json
{ "status": "ok" }
```

### `POST /optimize-energy`

**Request:**
```json
{
  "scenario_id": "string",
  "operator_notes": ["1-3 natural language strings"],
  "hours": [
    {
      "hour": 0,
      "demand_kwh": 90,
      "solar_kwh": 0,
      "tariff_bdt_per_kwh": 6
    }
    // ... 24 entries (hour 0-23)
  ],
  "battery": {
    "capacity_kwh": 220,
    "initial_energy_kwh": 110,
    "minimum_energy_kwh": 40,
    "max_charge_kwh_per_hour": 50,
    "max_discharge_kwh_per_hour": 50
  }
}
```

**Response:**
```json
{
  "scenario_id": "TEST-01",
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": {
        "hours": [12, 13],
        "factor": 0.25
      },
      "explanation": "Solar reduced to 25% during cleaning"
    }
  ],
  "hourly_plan": [
    {
      "hour": 0,
      "grid_kwh": 90,
      "solar_used_kwh": 0,
      "battery_action": "idle",
      "battery_kwh": 0,
      "battery_energy_after_kwh": 110
    }
    // ... 24 entries
  ],
  "total_grid_kwh": 2692.5,
  "total_cost_bdt": 38365,
  "peak_grid_kwh": 175,
  "plan_summary": "Optimized 24-hour campus energy plan..."
}
```

---

## 📋 Directive Types

| Directive | Description | Example Input |
|-----------|-------------|---------------|
| `solar_reduction` | Reduce usable solar in listed hours | "Reduce solar by 80% from noon to 2pm" |
| `minimum_battery_reserve` | Battery must stay ≥ level | "Keep 50% battery from 6pm to 9pm" |
| `no_charge_window` | Charging forbidden in listed hours | "Battery charger isolated 2am to 5am" |
| `no_discharge_window` | Discharging forbidden in listed hours | "No discharge from 6pm to 8pm" |
| `max_grid_window` | Grid import capped in listed hours | "Grid import max 155kWh from 6pm to 9pm" |
| `no_op` | Distractor/irrelevant note | "The library is extending hours" |

---

## ⚙️ How Each Package Works

### 1. shared-types (110 lines)

**Purpose:** Define all TypeScript types and Zod schemas for the entire system.

```typescript
// Key schemas
OptimizeEnergyRequestSchema   // Validates incoming requests
OptimizeEnergyResponseSchema  // Validates outgoing responses
DirectiveInterpretationSchema // Validates LLM output
HourlyPlanItemSchema          // Validates schedule items
```

### 2. llm-interpreter (309 lines)

**Purpose:** Convert natural-language operator notes into structured directives.

**Two modes:**
1. **Mistral API** (when API key provided) — Sends notes to Mistral LLM with structured output schema
2. **Deterministic fallback** (no API key) — Uses regex patterns to parse notes

**Example parsing:**
```
Input:  "Reduce solar by 80% from noon to 2pm"
Output: { directive_type: "solar_reduction", hours: [12,13], factor: 0.2 }
```

**Handles:**
- Clock times (noon, 2pm, midnight)
- Time ranges (from X to Y, between X and Y)
- Percentages (80%, 25% of, half)
- Multiple phrasings of same directive
- Distractor notes → no_op

### 3. guardrails (139 lines)

**Purpose:** Validate LLM output against strict rules before optimization.

**Checks performed:**
- `directive_type` ∈ allowed enum values
- `note_index` covers all notes (no missing/duplicates)
- `hours` array: unique, integers 0-23, ascending
- `solar_reduction.factor` ∈ [0, 1]
- `minimum_battery_reserve.minimum_energy_kwh` ∈ [0, capacity]
- `max_grid_window.max_grid_kwh` ≥ 0
- `applies` semantics enforced correctly
- Falls back to `no_op` on invalid input

### 4. optimizer (251 lines)

**Purpose:** Solve the Linear Programming problem to minimize electricity cost.

**Objective:** Minimize `Σ grid_kwh[h] × tariff_bdt_per_kwh[h]`

**Constraints:**
- Energy balance: `grid + solar + discharge = demand + charge`
- Battery SOC transitions
- Battery min/max bounds
- Charge/discharge rate limits
- Solar cap (after reductions)
- Grid cap (from directives)
- End-of-day neutrality (battery returns to initial)

**Variables per hour (4 variables × 24 hours = 96 variables):**
- `g_h` — Grid import
- `s_h` — Solar usage
- `c_h` — Battery charge
- `d_h` — Battery discharge
- `e_h` — Battery energy level

### 5. schedule-validator (212 lines)

**Purpose:** Replay the optimized schedule and verify all constraints.

**Validates:**
- Energy balance for each hour
- Solar usage ≤ effective solar
- Battery state transitions
- Battery stays within bounds
- Charge/discharge rate limits
- Grid cap enforcement
- End-of-day neutrality
- Recomputed totals match reported values

### 6. api (480 lines)

**Purpose:** HTTP server with routes, validation, and orchestration.

**Routes:**
- `GET /` — Dashboard UI
- `GET /health` — Health check
- `GET /sample-pack.json` — Sample cases
- `POST /optimize-energy` — Main optimization endpoint

**Pipeline:**
```
Request → Validate → LLM Interpret → Guardrails → Optimize → Validate → Response
```

---

## 🧪 Test Results

### Unit Tests
| Package | Tests | Status |
|---------|-------|--------|
| guardrails | 3 | ✅ Pass |
| optimizer | 2 | ✅ Pass |
| schedule-validator | 2 | ✅ Pass |

### E2E Tests (10 Public Sample Cases)
| Case | Label | Status |
|------|-------|--------|
| SAMPLE-01 | Solar cleaning + distractor | ✅ Pass |
| SAMPLE-02 | Battery charging maintenance | ✅ Pass |
| SAMPLE-03 | Emergency reserve as percentage | ✅ Pass |
| SAMPLE-04 | No-discharge protection test | ✅ Pass |
| SAMPLE-05 | Temporary feeder grid cap | ✅ Pass |
| SAMPLE-06 | Multiple notes with distractor | ✅ Pass |
| SAMPLE-07 | Reserve plus transformer cap | ✅ Pass |
| SAMPLE-08 | Separate charge/discharge outages | ✅ Pass |
| SAMPLE-09 | Reduction wording normalization | ✅ Pass |
| SAMPLE-10 | Multi-constraint evening operation | ✅ Pass |

**Total: 10/10 passed** ✅

---

## ⏱️ Performance

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Avg Latency | 24ms | ≤5,000ms | ✅ 208x faster |
| Min Latency | 9ms | — | ✅ |
| Max Latency | 103ms | ≤30,000ms | ✅ |
| Total (10 cases) | 236ms | — | ✅ |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Run tests
npm test

# 4. Start server
npm start

# 5. Test health
curl http://localhost:3000/health

# 6. Test optimization
curl -X POST http://localhost:3000/optimize-energy \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"TEST","operator_notes":["Reduce solar 50% noon to 2pm"],"hours":[...24 hours...],"battery":{...}}'
```

---

## 🔐 Environment Variables

```bash
# .env.local
MISTRAL_API_KEY=your_api_key_here    # Optional (uses fallback if missing)
MISTRAL_MODEL=mistral-small-latest   # Optional
PORT=3000                            # Optional
HOST=0.0.0.0                         # Optional
```

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| Total source code | 1,124 lines |
| Total packages | 6 |
| Test files | 4 |
| Test cases | 10 |
| API endpoints | 4 |
| Directive types | 6 |
| Avg latency | 24ms |
| Test pass rate | 100% |

---

## 🎯 What Makes This Project Special

1. **LLM + Math Optimization** — Uses AI to understand human language, then solves a Linear Programming problem
2. **Never Trusts LLM** — All LLM output validated by guardrails before use
3. **Deterministic Fallback** — Works even without API key using regex parsing
4. **Blazing Fast** — 24ms average latency (208x faster than target)
5. **Full Constraint Validation** — Every physical law verified before returning results
6. **Production Ready** — Error handling, input validation, type safety

---

## 🔧 Dependencies

```json
{
  "fastify": "^5.0.0",
  "javascript-lp-solver": "^1.0.3",
  "zod": "^3.23.0",
  "typescript": "^5.7.0",
  "vitest": "^3.0.0",
  "tsx": "^4.19.0"
}
```

---

## 📝 Notes for AI Assistants

- **TypeScript only** — No Python anywhere in the stack
- **Monorepo with npm workspaces** — Each package is independent
- **ESM modules** — All packages use `"type": "module"`
- **Zod for validation** — Request/response schemas defined in shared-types
- **LP solver** — Uses javascript-lp-solver for optimization
- **Mistral API** — Primary LLM, with regex fallback
- **Fastify** — HTTP server (can be swapped to Hono in ~15 min)
- **Vitest** — Testing framework

---

**Last Updated:** September 18, 2026  
**Status:** ✅ Production Ready  
**Tests:** 10/10 Passing  
**Performance:** 24ms avg latency
