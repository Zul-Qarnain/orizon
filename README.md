# GridWise LLM — Smart Campus Energy Optimization Engine

> **BUP CSE Fest 2026 Preliminary Round Solution**

GridWise is a production-ready, TypeScript-based microservice that accepts a 24-hour campus energy scenario and 1–3 natural-language operator notes, interprets notes into machine-checkable grid directives using an LLM, deterministically validates them through guardrails, formulates a linear program (LP) to minimize electricity grid import costs, and validates the final schedule before returning.

---

## 1. Architecture Overview

GridWise implements a strict 5-stage pipeline where each stage is isolated, testable, and modular:

```
Energy Data + Operator Notes 
          │
          ▼
┌─────────────────────────┐
│ 1. LLM Interpreter      │ Mistral API (or deterministic fallback parser)
└─────────┬───────────────┘
          │ Raw Interpretations
          ▼
┌─────────────────────────┐
│ 2. Guardrail Validator  │ Schema enforcement, hour windowing, factor/reserve bounds
└─────────┬───────────────┘
          │ Machine-Checkable Directives
          ▼
┌─────────────────────────┐
│ 3. Math LP Optimizer    │ Linear Program (grid/solar/battery flow & battery SOC recursion)
└─────────┬───────────────┘
          │ Hourly Plan (24h)
          ▼
┌─────────────────────────┐
│ 4. Schedule Validator   │ Replays physical limits, energy balance & directive compliance
└─────────┬───────────────┘
          │ Validated Schedule
          ▼
┌─────────────────────────┐
│ 5. Fastify API Response │ JSON Contract (HTTP 200)
└─────────────────────────┘
```

### Monorepo Structure

```
orizon/
├── packages/
│   ├── shared-types/          # Zod schemas & TypeScript contracts for request/response/directives
│   ├── llm-interpreter/       # Mistral API integration + deterministic NLP fallback parser
│   ├── guardrails/            # Deterministic validation & sanitization of LLM output
│   ├── optimizer/             # LP model builder + solver adapter (javascript-lp-solver)
│   ├── schedule-validator/    # Final schedule replay & constraint validator
│   └── api/                   # Fastify HTTP server (/health & /optimize-energy)
├── api/                       # Vercel serverless function handler (index.ts)
├── test/
│   ├── unit/                  # Unit tests per package (guardrails, optimizer, validator)
│   └── e2e/                   # E2E test suite running all 10 public sample cases
├── problem_doc/               # Official BUP CSE Fest public sample cases & PDF docs
├── vercel.json                # Vercel Serverless deployment config
├── .env.example
├── package.json
└── README.md
```

---

## 2. LLM Role & Guardrails

- **LLM Provider**: Mistral AI (`mistral-small-latest` or `mistral-medium-latest`).
- **Role**: Natural language interpretation of operator notes into one of 6 canonical directive types:
  - `solar_reduction`: `{"hours": [...], "factor": number}` (factor = fraction remaining)
  - `minimum_battery_reserve`: `{"hours": [...], "minimum_energy_kwh": number}`
  - `no_charge_window`: `{"hours": [...]}`
  - `no_discharge_window`: `{"hours": [...]}`
  - `max_grid_window`: `{"hours": [...], "max_grid_kwh": number}`
  - `no_op`: `null` (distractors or non-grid notes)
- **Guardrail Layer (`@gridwise/guardrails`)**:
  - Validates `directive_type` against the 6 canonical enum values.
  - Ensures `hours` array contains strictly ascending, unique integers in `0..23` (start-inclusive, end-exclusive).
  - Validates numeric boundaries (`solar_reduction.factor` $\in [0, 1]$, `minimum_energy_kwh` $\le$ battery capacity).
  - Enforces `applies: false` iff `directive_type == 'no_op'`.
  - Fallbacks malformed outputs cleanly to `no_op` without crashing.

---

## 3. Mathematical Optimization Formulation

GridWise models 24 hourly intervals ($h=0\dots23$) as a Linear Program (LP):

$$\text{Minimize } \text{Total Cost} = \sum_{h=0}^{23} G_h \cdot T_h$$

**Subject to:**

1. **Per-Hour Energy Balance:**
   $$G_h + S_h + D_h - C_h = \text{demand}_h \quad \forall h \in [0, 23]$$

2. **Solar Availability Cap:**
   $$0 \le S_h \le \text{effective\_solar}_h \quad \forall h \in [0, 23]$$

3. **Battery State Recursion:**
   - $h = 0: E_0 - C_0 + D_0 = E_{\text{initial}}$
   - $h > 0: E_h - E_{h-1} - C_h + D_h = 0$

4. **Battery Energy Bounds:**
   $$\text{active\_min}_h \le E_h \le \text{capacity} \quad \forall h \in [0, 23]$$

5. **Charge / Discharge Limits:**
   $$0 \le C_h \le \text{max\_charge}_h, \quad 0 \le D_h \le \text{max\_discharge}_h$$

6. **End-of-Day Neutrality:**
   $$E_{23} = E_{\text{initial}}$$

---

## 4. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_MODEL=mistral-small-latest
HOST=0.0.0.0
PORT=3000
```

*Note: If `MISTRAL_API_KEY` is not provided, GridWise seamlessly switches to its built-in deterministic NLP fallback parser.*

---

## 5. Local Quickstart & Execution

```bash
# 1. Clone the repository
git clone https://github.com/Zul-Qarnain/orizon.git
cd orizon

# 2. Install dependencies
npm install

# 3. Build all TypeScript packages
npm run build

# 4. Run full test suite (unit + 10 E2E public sample cases)
npm test

# 5. Start local HTTP API server
npm start
```

---

## 6. Verification & `curl` Examples

### `GET /health`

```bash
curl -X GET http://localhost:3000/health
```

**Expected Response (200 OK):**
```json
{ "status": "ok" }
```

### `POST /optimize-energy`

```bash
curl -X POST http://localhost:3000/optimize-energy \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_id": "SAMPLE-01",
    "operator_notes": [
      "Facilities will wash the rooftop solar panels from noon until 2 PM. During cleaning, usable solar should be treated as roughly 25% of the forecast.",
      "The sports office moved next month registration deadline."
    ],
    "hours": [
      { "hour": 0, "demand_kwh": 90, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 1, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 2, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 3, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 4, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 5, "demand_kwh": 95, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 6, "demand_kwh": 110, "solar_kwh": 5, "tariff_bdt_per_kwh": 8 },
      { "hour": 7, "demand_kwh": 130, "solar_kwh": 20, "tariff_bdt_per_kwh": 10 },
      { "hour": 8, "demand_kwh": 150, "solar_kwh": 50, "tariff_bdt_per_kwh": 12 },
      { "hour": 9, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14 },
      { "hour": 10, "demand_kwh": 175, "solar_kwh": 130, "tariff_bdt_per_kwh": 16 },
      { "hour": 11, "demand_kwh": 180, "solar_kwh": 160, "tariff_bdt_per_kwh": 16 },
      { "hour": 12, "demand_kwh": 185, "solar_kwh": 180, "tariff_bdt_per_kwh": 15 },
      { "hour": 13, "demand_kwh": 180, "solar_kwh": 170, "tariff_bdt_per_kwh": 14 },
      { "hour": 14, "demand_kwh": 170, "solar_kwh": 140, "tariff_bdt_per_kwh": 13 },
      { "hour": 15, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14 },
      { "hour": 16, "demand_kwh": 170, "solar_kwh": 45, "tariff_bdt_per_kwh": 18 },
      { "hour": 17, "demand_kwh": 185, "solar_kwh": 10, "tariff_bdt_per_kwh": 22 },
      { "hour": 18, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 28 },
      { "hour": 19, "demand_kwh": 215, "solar_kwh": 0, "tariff_bdt_per_kwh": 30 },
      { "hour": 20, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 26 },
      { "hour": 21, "demand_kwh": 175, "solar_kwh": 0, "tariff_bdt_per_kwh": 18 },
      { "hour": 22, "demand_kwh": 135, "solar_kwh": 0, "tariff_bdt_per_kwh": 10 },
      { "hour": 23, "demand_kwh": 105, "solar_kwh": 0, "tariff_bdt_per_kwh": 7 }
    ],
    "battery": {
      "capacity_kwh": 220,
      "initial_energy_kwh": 110,
      "minimum_energy_kwh": 40,
      "max_charge_kwh_per_hour": 50,
      "max_discharge_kwh_per_hour": 50
    }
  }'
```

---

## 7. Cloud Deployment Target & Notes

- **Cloud Platform**: Vercel Serverless Functions / Free Tier Web Service.
- **Entrypoint**: `api/index.ts` with root `vercel.json` rewrites.
- **Docker Note**: Per the updated challenge specification (Section 8a), deployment is performed directly to a free-tier cloud host without a Docker image.
