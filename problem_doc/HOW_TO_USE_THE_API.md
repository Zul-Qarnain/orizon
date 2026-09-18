# How to use the GridWise API

This is the team usage guide. The PDFs in this folder are the official BUP spec; they are not our runbook.

| File | What it is |
|---|---|
| `BUP_CSE_FEST_2026_Preliminary_Problem_Statement_GridWise_LLM.pdf` | Canonical API contract, directives, energy rules |
| `BUP_CSE_FEST_2026_Participant_Guide_&_Evaluation_Rubric_GridWise_LLM.pdf` | Submission, scoring, README requirements |
| `BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json` | 10 worked public cases |
| This file | How to call **our** deployed service |

**Base URL:** https://orizon-jet.vercel.app

No auth, API key, or VPN. JSON in, JSON out.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Judge readiness probe |
| `POST` | `/optimize-energy` | Interpret notes + 24-hour cost-minimizing plan |
| `GET` | `/` | Optional local/test dashboard (not scored) |

### `GET /health`

Must return HTTP 200:

```json
{ "status": "ok" }
```

```bash
curl -s https://orizon-jet.vercel.app/health
```

### `POST /optimize-energy`

Send one scenario. Get back one interpretation per note plus a 24-row hourly plan.

**HTTP codes**

| Code | When |
|---|---|
| 200 | Valid request, plan returned |
| 400 | Malformed JSON or schema (wrong field types, not 24 hours, 0 or >3 notes) |
| 500 | Internal failure (never includes secrets or stack traces) |

---

## Request body

```json
{
  "scenario_id": "GRID-101",
  "operator_notes": [
    "Solar output will drop to about 20% from 1 PM to 3 PM.",
    "Do not charge the battery between 2 PM and 4 PM.",
    "The cafeteria menu changes tomorrow."
  ],
  "hours": [
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

Rules the judge checks:

- `hours` has **exactly 24** entries, `hour` 0..23
- `operator_notes` has **1 to 3** non-empty strings
- time windows are start-inclusive / end-exclusive (`1 PM to 3 PM` → `[13, 14]`)

---

## Response body

| Field | Meaning |
|---|---|
| `scenario_id` | Echo of the request |
| `directive_interpretation` | One entry per note, `note_index` 0..N-1 |
| `hourly_plan` | 24 rows, hour 0..23 |
| `total_grid_kwh` | Sum of `grid_kwh` |
| `total_cost_bdt` | `Σ grid_kwh × tariff` |
| `peak_grid_kwh` | Max hourly `grid_kwh` |
| `plan_summary` | Short human text (not the scored interpretation) |

Each interpretation:

| `directive_type` | `applies` | `structured_adjustment` |
|---|---|---|
| `solar_reduction` | true | `{ hours, factor }` — remaining solar fraction |
| `minimum_battery_reserve` | true | `{ hours, minimum_energy_kwh }` |
| `no_charge_window` | true | `{ hours }` |
| `no_discharge_window` | true | `{ hours }` |
| `max_grid_window` | true | `{ hours, max_grid_kwh }` |
| `no_op` | **false** | **null** |

Hourly row: `hour`, `grid_kwh`, `solar_used_kwh`, `battery_action` (`charge` \| `discharge` \| `idle`), `battery_kwh`, `battery_energy_after_kwh`.

---

## Curl: SAMPLE-01 against production

Use the official JSON (do not hard-code hidden-case wording):

```bash
python3 - <<'PY'
import json, urllib.request
from pathlib import Path

pack = json.loads(Path("problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json").read_text())
case = next(c for c in pack["cases"] if c["input"]["scenario_id"] == "SAMPLE-01")
req = urllib.request.Request(
    "https://orizon-jet.vercel.app/optimize-energy",
    data=json.dumps(case["input"]).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as res:
    body = json.loads(res.read().decode())
print("status 200, cost", body["total_cost_bdt"])
print([(d["directive_type"], d["applies"]) for d in body["directive_interpretation"]])
PY
```

Expected for SAMPLE-01: `solar_reduction` then `no_op`, `total_cost_bdt` ≈ **38365**.

---

## Run all 10 public samples locally

From repo root (no live LLM required for this pack):

```bash
npm test
```

That posts every case in `BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json` to the in-process API and checks interpretation + schedule replay.

---

## Local server

```bash
npm install
npm run build
npm start
# GET  http://localhost:3000/health
# POST http://localhost:3000/optimize-energy
# UI   http://localhost:3000
```

Set `MISTRAL_API_KEY` in `.env.local` for the live LLM path. Production already has it.

---

## What judges score on the wire

Correctness of `directive_interpretation` and a feasible `hourly_plan` beats a cheaper invalid plan. Totals must match recomputation from `hourly_plan`. Hidden notes may paraphrase the same six directive types; they are not the public JSON wording.
