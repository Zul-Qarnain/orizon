# Agent Build Prompt — GridWise LLM (BUP CSE Fest 2026 Preliminary)

Paste this whole document as the task for your coding agent (Claude Code or equivalent). It is self-contained — the agent does not need the original PDFs, only this spec.

---

## 0. Role & Constraints

You are the lead architect and implementer for a 3-person hackathon team. Build a **complete, production-ready, submission-ready** solution for the challenge specified below.

Hard constraints:
- **JavaScript/TypeScript only. No Python**, anywhere in the stack (including tooling/scripts).
- Available infra: **NeonDB (Postgres), Firebase, Vercel, Mistral (LLM API), Microsoft Foundry**. Use only what the challenge actually needs — do not add infra for its own sake.
- **Do not overengineer.** Prefer the simplest architecture that reliably satisfies the judge harness described below. A single deployable API service is the core deliverable; add a frontend/dashboard only if it doesn't threaten reliability or timeline.
- **Do not invent directive types, fields, or rules.** The directive set, schemas, and constraints below are exhaustive and canonical — implement exactly them.
- Work in phases: (1) design architecture + folder structure, (2) confirm/adjust briefly, (3) implement incrementally, (4) test against public samples, (5) fix, (6) verify full round-trip against every rule below before declaring done.

---

## 1. What You're Building

One HTTP API service ("GridWise") that:
1. Accepts a 24-hour campus energy scenario + 1–3 natural-language operator notes.
2. Uses an **LLM** to interpret each note into a structured, machine-checkable directive (or `no_op`).
3. **Deterministically validates** that LLM output against strict guardrails (never trust LLM output directly).
4. Feeds valid directives into a **math optimizer** that produces a 24-hour grid/solar/battery schedule minimizing grid electricity cost.
5. **Replays/validates** the final schedule against all energy, battery, and directive constraints before returning it.
6. Returns one JSON response containing both the interpretation and the schedule.

Pipeline (must be literally implemented as separate, testable stages — not a single monolithic LLM call):
```
Energy Data + Operator Notes → LLM Interpreter → Guardrail Validator → Math Optimizer → Final Validator → API Response
```

LLM use is **mandatory** and must sit in the actual interpretation path (not just for `plan_summary` text). Using it only for cosmetic text fails the challenge outright.

---

## 2. API Contract (exact — judge harness checks these names/shapes literally)

### `GET /health`
Returns `200` with:
```json
{ "status": "ok" }
```
Must be ready within 60 seconds of process start.

### `POST /optimize-energy`
Timeout budget: must complete in **≤30 seconds** (p95 target ≤5s for full credit; 5–15s partial; 15–30s minimal; >30s = failure).

**Request body:**
```json
{
  "scenario_id": "string",
  "operator_notes": ["1 to 3 non-empty strings"],
  "hours": [ /* exactly 24 entries, hour 0..23 */
    { "hour": 0, "demand_kwh": 180, "solar_kwh": 0, "tariff_bdt_per_kwh": 7 }
  ],
  "battery": {
    "capacity_kwh": 500,
    "initial_energy_kwh": 200,
    "minimum_energy_kwh": 50,
    "max_charge_kwh_per_hour": 100,
    "max_discharge_kwh_per_hour": 100
  }
}
```

**Response body:**
```json
{
  "scenario_id": "must echo request",
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": { "hours": [13,14], "factor": 0.2 },
      "explanation": "short human explanation"
    }
  ],
  "hourly_plan": [
    {
      "hour": 0,
      "grid_kwh": 0,
      "solar_used_kwh": 0,
      "battery_action": "charge | discharge | idle",
      "battery_kwh": 0,
      "battery_energy_after_kwh": 0
    }
  ],
  "total_grid_kwh": 0,
  "total_cost_bdt": 0,
  "peak_grid_kwh": 0,
  "plan_summary": "short human-readable string"
}
```

HTTP codes: `200` success · `400` malformed/structurally invalid JSON · `422` optional (well-formed but semantically invalid) · `500` controlled internal error (never leak secrets or stack traces in body or logs).

Never crash on malformed input or LLM/provider errors — fail safe and controlled.

---

## 3. Operator Directive Types (exhaustive — do not add others)

| directive_type | Meaning | Required `structured_adjustment` |
|---|---|---|
| `solar_reduction` | Reduce usable solar in listed hours | `{"hours":[...], "factor": number}` — factor = fraction of solar *remaining* (an "80% reduction" ⇒ `factor: 0.2`) |
| `minimum_battery_reserve` | Battery must stay ≥ level in listed hours | `{"hours":[...], "minimum_energy_kwh": number}` |
| `no_charge_window` | Charging forbidden in listed hours | `{"hours":[...]}` |
| `no_discharge_window` | Discharging forbidden in listed hours | `{"hours":[...]}` |
| `max_grid_window` | Grid import capped in listed hours | `{"hours":[...], "max_grid_kwh": number}` |
| `no_op` | Note is a distractor / doesn't affect the schedule | `null` |

Rules:
- Exactly **one** `directive_interpretation` entry per operator note, returned in `note_index` order `0..N-1`. No missing/duplicate/out-of-order entries.
- `no_op` is the **only** directive allowed with `applies: false`. Every other directive requires `applies: true`.
- Every `hours` array = unique integers `0..23`, strictly ascending.
- Time windows are **start-inclusive, end-exclusive**: "1 PM to 3 PM" → `[13,14]` (not `[13,14,15]`).
- Same underlying directive may appear in **arbitrarily different phrasing** (percentages, fractions, clock times, "roughly X%", indirect language) — the LLM must generalize, not pattern-match fixed phrases. Do not hardcode the sample wording.
- The LLM must never invent demand/solar/tariff/battery values or unsupported directive types.
- Distractor notes (irrelevant to energy scheduling) must resolve to `no_op` — not be forced into a real directive.

---

## 4. Optimization Problem

**Objective:** minimize `total_cost_bdt = Σ grid_kwh[h] * tariff_bdt_per_kwh[h]` for h=0..23, subject to every constraint below. Correctness beats cost — an infeasible cheap plan scores zero for that case.

**Per-hour energy balance (must hold exactly, within 0.01 tolerance):**
```
grid_kwh[h] + solar_used_kwh[h] + battery_discharge_kwh[h]
  = demand_kwh[h] + battery_charge_kwh[h]
```

**Battery state transition:**
```
charge:    E_after = E_before + battery_kwh
discharge: E_after = E_before - battery_kwh
idle:      E_after = E_before, battery_kwh = 0
```

**Bounds & limits:**
- `active_minimum_energy_kwh[h] <= E_after[h] <= capacity_kwh` where `active_minimum` is `max(battery.minimum_energy_kwh, any minimum_battery_reserve directive value)` for that hour.
- `battery_kwh <= max_charge_kwh_per_hour` when charging; `<= max_discharge_kwh_per_hour` when discharging.
- `0 <= solar_used_kwh[h] <= effective_solar[h]`, where `effective_solar[h] = solar_kwh[h] * factor` if a `solar_reduction` directive is active for hour h, else `solar_kwh[h]`. Unused solar is curtailed (no export/sell-back).
- **End-of-day neutrality:** `battery_energy_after_kwh[23] == battery.initial_energy_kwh` (exact, within tolerance). The battery cannot be a free one-time energy source.

**Directive effects on the math (deterministic, applied before/inside optimization, not by the LLM):**
| Directive | Effect |
|---|---|
| `solar_reduction` | `effective_solar[h] = original_solar[h] * factor` for listed hours |
| `minimum_battery_reserve` | raises active minimum bound for listed hours |
| `no_charge_window` | forces `battery_charge_kwh[h] = 0` for listed hours |
| `no_discharge_window` | forces `battery_discharge_kwh[h] = 0` for listed hours |
| `max_grid_window` | `grid_kwh[h] <= max_grid_kwh` for listed hours |

**Recommended approach:** formulate as a linear program (LP) — this is a linear-cost, linear-constraint scheduling problem (grid/solar/battery flow + battery SOC recursion + box/rate constraints). Use a JS/TS-compatible LP/solver library (e.g. `javascript-lp-solver`, `glpk.js`, or a hand-rolled small LP via simplex/HiGHS-wasm bindings) rather than heuristics, since feasibility and optimality both score. A well-tested greedy/heuristic fallback is acceptable only as a safety net if the solver fails on an edge case — never as the primary path, since judged optimality (`min(1, organizer_optimal_cost / recalculated_team_cost)`) rewards true optimality.

---

## 5. LLM Interpretation Guardrails (deterministic validation layer — mandatory)

Treat all LLM output as **untrusted** until it passes every check below. Reject/repair/retry rather than silently pass through invalid structured output.

- `directive_type` ∈ the six values in Section 3 — nothing else accepted.
- `note_index` maps to a real note in the request; every note covered exactly once.
- `hours`: unique ints, `0..23`, ascending.
- `solar_reduction.factor` ∈ `[0, 1]`.
- `minimum_battery_reserve.minimum_energy_kwh`: finite, ≥0, ≤ `battery.capacity_kwh`.
- `max_grid_window.max_grid_kwh`: finite, ≥0.
- `applies` semantics enforced exactly as in Section 3.
- No modification of base demand/tariff/battery parameters — directives only affect the modeled quantities listed in Section 4.
- On malformed/unsupported LLM output: controlled fallback (e.g., structured re-prompt with the schema, or safe `no_op` fallback for that note with logging) — **never** crash, **never** invent a directive type to compensate.

Recommended implementation: use Mistral's function-calling / structured-output (JSON schema) mode to constrain output shape at generation time, then still run the full guardrail validator in code as a second, independent check — do not rely on the LLM provider's schema enforcement alone.

---

## 6. Team Split (3 people, minimal merge conflicts)

Design the repo as isolated modules with a thin, versioned contract between them (e.g. TypeScript interfaces in a shared `types` package) so each person can build/test independently against fixtures before integration.

- **Engineer A — LLM Interpretation & Guardrails**: prompt design, Mistral integration, structured-output parsing, the deterministic guardrail validator, paraphrase-robustness test set.
- **Engineer B — Optimization Engine & Energy Validator**: LP formulation, solver integration, directive-to-constraint translation, final schedule replay/validator, energy-balance and battery-rule unit tests.
- **Engineer C — API, Infra, Deployment, Docs**: Express/Fastify/Hono service scaffold, request/response schema validation (e.g. Zod), `/health`, error handling, logging/secret hygiene, Docker fallback image, Vercel deployment, README, CI, and end-to-end tests wiring A+B together.

Suggested folder structure:
```
gridwise/
├── packages/
│   ├── shared-types/          # Engineer C owns scaffolding; shared by all — request/response/directive TS types + Zod schemas
│   ├── llm-interpreter/       # Engineer A — Mistral client, prompt templates, structured parsing
│   ├── guardrails/            # Engineer A — deterministic validation of LLM output
│   ├── optimizer/             # Engineer B — LP model builder + solver adapter
│   ├── schedule-validator/    # Engineer B — final replay/validation of hourly_plan
│   └── api/                   # Engineer C — HTTP server, routing, orchestration of the pipeline stages
├── test/
│   ├── fixtures/               # public sample cases + hand-built paraphrase/edge cases
│   ├── unit/                   # per-package unit tests
│   └── e2e/                    # full POST /optimize-energy round-trip tests
├── docker/
│   └── Dockerfile              # fallback image, binds 0.0.0.0, no baked secrets
├── .env.example
├── README.md
└── package.json                # npm/pnpm workspaces
```

Each package should be independently unit-testable with mocked inputs from its neighbor (e.g. `optimizer` tested with hand-built directive arrays, without needing a live LLM call).

---

## 7. Non-Negotiable Quality Bar (what the judge actually scores)

Build and self-test against every item below before considering the project done:

1. **Interpretation correctness** — every note → correct `applies`/`directive_type`/`hours`/numeric values, robust to paraphrasing (test with reworded versions of the 4 example notes in the spec, not just verbatim).
2. **Downstream application** — a correctly-interpreted directive that isn't actually reflected in `hourly_plan` must count as a failure; write explicit tests that assert schedule obeys each directive type.
3. **Schedule validity** — energy balance, battery bounds/transitions/rate limits, solar cap, end-of-day neutrality, all hold exactly (within 0.01 tolerance) on every test case.
4. **Reported totals match recomputation** — `total_grid_kwh`/`total_cost_bdt`/`peak_grid_kwh` must equal values independently recalculated from `hourly_plan`.
5. **Schema/contract exactness** — field names, types, enum values, HTTP codes, and 24-entry array lengths match Section 2 exactly.
6. **Reliability** — malformed JSON, LLM/provider timeouts or errors, and repeated rapid requests must not crash the service or return 5xx for valid input.
7. **Secret hygiene** — no API keys/tokens in repo, logs, or responses; `.env.example` only, real secrets via deployment env vars.
8. **Local reproducibility** — README must let a stranger `git clone` → set env vars → run → curl `/health` → run one public sample against `/optimize-energy`, with zero undocumented steps.
9. **Docker fallback** — image builds, exposes documented port, binds `0.0.0.0`, reaches `/health`, no baked secrets, works via one documented `docker run` command.
10. **Deployed public endpoint** — reachable with no auth/VPN/dashboard gate, stable for the full evaluation window.

---

## 8. Deliverables Checklist

- [ ] Deployed public HTTPS API exposing `GET /health` and `POST /optimize-energy` exactly as specified.
- [ ] Source repo (workspaces layout above), clean history, no secrets.
- [ ] `README.md`: architecture summary, LLM provider/model used and its exact role, guardrail description, optimizer/solver choice, env var names, exact run command, `/health` and `/optimize-energy` curl examples, public-sample test command, dependencies, known limitations.
- [ ] `.env.example` with all required variable names (no values).
- [ ] Pullable Docker fallback image + documented `docker pull`/`docker run` command.
- [ ] Automated test suite: unit tests per package + e2e tests running all provided public sample cases + hand-authored paraphrase/edge/adversarial cases (contradictory-seeming notes resolved per spec, distractor notes, boundary hours like 0 and 23, factor edge values 0 and 1).
- [ ] (Tie-break only, not scored directly) ≤3-minute architecture/solution video script/outline — note this as a TODO for the humans to record; do not attempt to generate video.

---

## 9. Execution Instructions for the Agent

1. Propose the architecture and folder structure first (brief) — confirm it matches Section 6, then proceed without waiting for approval on every subsequent step.
2. Scaffold the monorepo, shared types/Zod schemas, and CI/test runner first — this is the contract every package codes against.
3. Implement `optimizer` + `schedule-validator` against hand-built fixtures (no LLM dependency) so the math is verified independently and early.
4. Implement `llm-interpreter` + `guardrails` against the Mistral API, using the four example notes plus several paraphrases as the first test set.
5. Wire the `api` package to orchestrate: parse request → LLM interpret → guardrail validate → build optimizer input → solve → final validate → build response.
6. Run the full public sample case pack (10 cases) end-to-end; for each, verify interpretation semantics, constraint satisfaction, and recomputed totals — not just HTTP 200.
7. Add malformed-input, timeout, and provider-error handling; verify no crash and no secret leakage under those paths.
8. Write the Dockerfile, verify it builds and serves correctly with no baked secrets.
9. Write the README following the checklist in Section 8, then do a literal clean-environment dry run of the quickstart instructions.
10. Deploy (Vercel or equivalent reachable host), verify externally with no VPN/auth, and confirm `/health` and one `/optimize-energy` call succeed from outside your dev environment.
11. Report back: what was built, test results, any deviations from this spec and why, and anything still open.
