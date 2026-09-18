# GridWise LLM — Campus Energy Optimization API

BUP CSE Fest 2026 preliminary. Public HTTPS API. **No login, no API key, no VPN.**

| | |
|---|---|
| **Live base URL** | https://orizon-jet.vercel.app |
| **On-site API docs** | https://orizon-jet.vercel.app/#api-docs |
| **Judge endpoints** | `GET /health` and `POST /optimize-energy` only |
| **LLM** | Mistral `mistral-small-latest` on the real `operator_notes` path |
| **Docker fallback** | `javaman12/gridwise-llm:latest` |

The Problem Statement is the canonical contract. This README is the copy-paste runbook for that contract.

---

## 1. What the judge calls

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| `GET` | `/health` | none | none | `200` `{"status":"ok"}` |
| `POST` | `/optimize-energy` | none | JSON scenario | `200` interpretation + 24-hour plan |
| `GET` | `/` | none | none | Optional dashboard. **Not scored.** |

Accepts JSON, returns JSON. Endpoint names match the Problem Statement exactly.

### HTTP status codes (Problem Statement §6.1)

| Code | When |
|---|---|
| `200` | Health ready, or a valid optimize request returned a plan |
| `400` | Malformed JSON or structurally invalid body (wrong types, not 24 hours, 0 or >3 notes) |
| `422` | Optional; not required. We use `400` for invalid bodies |
| `500` | Controlled internal error. No secrets, no stack traces |

Per-request budget: **30s**. Typical live latency is well under **5s**.

---

## 2. `GET /health`

Must return HTTP **200**:

```json
{ "status": "ok" }
```

**Live**

```bash
curl -s https://orizon-jet.vercel.app/health
# {"status":"ok"}
```

**Local / Docker** (after the service is listening on port 3000)

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

---

## 3. `POST /optimize-energy`

Send **one** scenario JSON object. Get back **one** interpretation per operator note plus a 24-row hourly plan.

**Live** (copy-paste from the repo root; posts official SAMPLE-01 `input`, not the whole pack file):

```bash
python3 - <<'PY'
import json, urllib.request
from pathlib import Path

base = "https://orizon-jet.vercel.app"
pack = json.loads(Path("problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json").read_text())
body = next(c["input"] for c in pack["cases"] if c["input"]["scenario_id"] == "SAMPLE-01")

req = urllib.request.Request(
    base + "/optimize-energy",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as res:
    out = json.loads(res.read().decode())
print("HTTP", res.status)
print("scenario_id", out["scenario_id"])
print("directives", [(d["note_index"], d["directive_type"], d["applies"]) for d in out["directive_interpretation"]])
print("hours", len(out["hourly_plan"]), "cost", out["total_cost_bdt"], "peak", out["peak_grid_kwh"])
PY
```

Expected for SAMPLE-01: HTTP 200, `solar_reduction` then `no_op`, hours `[12, 13]`, factor `0.25`, `total_cost_bdt` **38365**.

Same POST with curl:

```bash
python3 -c 'import json,pathlib; p=json.loads(pathlib.Path("problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json").read_text()); print(json.dumps(next(c["input"] for c in p["cases"] if c["input"]["scenario_id"]=="SAMPLE-01")))' \
| curl -s -X POST https://orizon-jet.vercel.app/optimize-energy \
    -H 'Content-Type: application/json' \
    -d @-
```

Same calls against a local process: use `http://127.0.0.1:3000` instead of the Vercel host.

### 3.1 Request body (Problem Statement §7)

Required top-level fields:

| Field | Type | Rule |
|---|---|---|
| `scenario_id` | string | Non-empty id. Echoed in the response |
| `operator_notes` | array of string | **1–3** non-empty natural-language notes |
| `hours` | array | **Exactly 24** entries, unique `hour` **0..23** |
| `battery` | object | Capacity, start energy, reserve, charge/discharge limits |

Each `hours[]` item:

| Field | Type | Meaning |
|---|---|---|
| `hour` | integer 0–23 | Unique hour index |
| `demand_kwh` | number ≥ 0 | Campus demand this hour |
| `solar_kwh` | number ≥ 0 | Base solar before note adjustments |
| `tariff_bdt_per_kwh` | number ≥ 0 | Grid price this hour |

`battery`:

| Field | Meaning |
|---|---|
| `capacity_kwh` | Max stored energy |
| `initial_energy_kwh` | Energy at the start of hour 0 |
| `minimum_energy_kwh` | Base reserve; battery never goes below this |
| `max_charge_kwh_per_hour` | Max energy added in one hour |
| `max_discharge_kwh_per_hour` | Max energy removed in one hour |

Shape (hours truncated — a real request needs all 24):

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

Worked 24-hour bodies: `problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json` → `cases[].input`.

### 3.2 Response body (Problem Statement §10)

| Field | Type | Rule |
|---|---|---|
| `scenario_id` | string | Must match the request |
| `directive_interpretation` | array | **One entry per note**, `note_index` 0..N-1, no gaps/duplicates |
| `hourly_plan` | array[24] | One row per hour 0..23 |
| `total_grid_kwh` | number | Sum of `hourly_plan[].grid_kwh` |
| `total_cost_bdt` | number | `Σ grid_kwh × tariff` |
| `peak_grid_kwh` | number | Max hourly `grid_kwh` |
| `plan_summary` | string | Human text. **Not** the scored interpretation |

Each `directive_interpretation[]` item:

| Field | Rule |
|---|---|
| `note_index` | Zero-based index of that `operator_notes` entry |
| `applies` | `true` for every non-`no_op` directive; `false` **only** for `no_op` |
| `directive_type` | One of the six types below |
| `structured_adjustment` | Exact object for that type, or `null` only for `no_op` |
| `explanation` | Short reason. Wording does not need to match the public JSON |

| `directive_type` | `applies` | `structured_adjustment` |
|---|---|---|
| `solar_reduction` | true | `{ "hours": [...], "factor": 0..1 }` remaining solar fraction |
| `minimum_battery_reserve` | true | `{ "hours": [...], "minimum_energy_kwh": n }` |
| `no_charge_window` | true | `{ "hours": [...] }` |
| `no_discharge_window` | true | `{ "hours": [...] }` |
| `max_grid_window` | true | `{ "hours": [...], "max_grid_kwh": n }` |
| `no_op` | **false** | **null** (distractor / not today's schedule) |

`hours` inside an adjustment: unique integers **0–23**, **ascending**, start-inclusive / end-exclusive.

- `"noon until 2 PM"` → `[12, 13]`
- `"1 PM to 3 PM"` → `[13, 14]`
- `"80% reduction"` → `factor = 0.2` (remaining fraction, not the cut)

Each `hourly_plan[]` item:

| Field | Allowed |
|---|---|
| `hour` | Integer 0–23 |
| `grid_kwh` | ≥ 0 grid energy bought this hour |
| `solar_used_kwh` | ≥ 0, cannot exceed effective solar |
| `battery_action` | exactly `charge`, `discharge`, or `idle` |
| `battery_kwh` | ≥ 0 magnitude; **must be 0** when `idle` |
| `battery_energy_after_kwh` | Energy after this hour |

Example interpretation fragment (Problem Statement §10.4):

```json
{
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": { "hours": [13, 14], "factor": 0.2 },
      "explanation": "Solar availability is reduced during panel cleaning."
    },
    {
      "note_index": 2,
      "applies": false,
      "directive_type": "no_op",
      "structured_adjustment": null,
      "explanation": "This note does not affect today's energy schedule."
    }
  ]
}
```

The judge independently **replays** `hourly_plan`. Equivalent optimal schedules are accepted; the action sequence does not have to match the public reference byte-for-byte. Totals must match a recompute from `hourly_plan` within **0.01**.

---

## 4. Local quickstart (clean machine)

```bash
git clone https://github.com/Zul-Qarnain/orizon.git
cd orizon
cp .env.example .env.local
# set MISTRAL_API_KEY in .env.local (required for hidden paraphrases)
npm install
npm run build
npm test
npm start
```

Then:

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

Dashboard (not scored): http://127.0.0.1:3000 — pick SAMPLE-01, Run.

`npm test` posts all **10** public cases from `problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json` into the in-process API and checks interpretation + schedule replay.

`npm start` binds **`0.0.0.0:3000`**.

---

## 5. Environment (names only — never commit values)

Copy `.env.example` → `.env.local`.

| Name | Required | Role |
|---|---|---|
| `MISTRAL_API_KEY` | Yes on the live path | Mistral key for `operator_notes` |
| `MISTRAL_API_KEYS` | No | Extra keys, comma-separated; used on 429/401/403 |
| `MISTRAL_MODEL` | No | Default `mistral-small-latest` |
| `LLM_TIMEOUT_MS` | No | Server-side LLM budget, default `1400` |
| `HOST` | No | Default `0.0.0.0` |
| `PORT` | No | Default `3000` |

Do not put secrets in git, Docker layers, logs, or API responses. Production already has the live key.

---

## 6. How one POST is processed

```
JSON body
  → Zod request schema
  → Mistral interprets each operator note (mandatory LLM stage)
  → Guardrails sanitize type / hours / applies / numbers
  → javascript-lp-solver 24-hour LP (min Σ grid_kwh × tariff)
  → Independent schedule replay
  → JSON response
```

| Package | Role |
|---|---|
| `packages/shared-types` | Zod request/response/directive contracts |
| `packages/llm-interpreter` | Mistral JSON mode + regex fallback if the LLM times out |
| `packages/guardrails` | Deterministic sanitizer; invalid items become `no_op` |
| `packages/optimizer` | 24-hour LP |
| `packages/schedule-validator` | Replay of the returned plan |
| `packages/api` | Fastify: `/health`, `/optimize-energy` |
| `api/index.ts` | Vercel entry |

LLM is **not** used only for `plan_summary`. Guardrails never trust the model: allowed `directive_type` only, unique hours 0–23 ascending, `factor` in `[0,1]`, finite non-negative reserves/caps, `applies=false` only with `no_op`.

Energy rules the optimizer and validator enforce: energy balance, effective solar after `solar_reduction`, charge/discharge rate limits, grid cap, battery between active min and capacity, **end-of-day battery = `initial_energy_kwh`**.

---

## 7. Docker fallback

Public image: **`javaman12/gridwise-llm:latest`**  
Hub: https://hub.docker.com/r/javaman12/gridwise-llm

```bash
docker pull javaman12/gridwise-llm:latest
docker run --rm -p 3000:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e MISTRAL_API_KEY \
  -e MISTRAL_API_KEYS \
  -e MISTRAL_MODEL=mistral-small-latest \
  javaman12/gridwise-llm:latest

curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

Binds `0.0.0.0:3000`. Pass keys at **run time**. Nothing secret is baked into the image.

---

## 8. Live deploy

Host: **Vercel** region `cdg1` (public HTTPS, no login). Hobby `maxDuration` 30s. Entrypoint `api/index.ts`.

```bash
npx vercel --prod
```

Set `MISTRAL_API_KEY` / `MISTRAL_API_KEYS` / `MISTRAL_MODEL` in the Vercel project UI. Ping `/health` so the function stays warm.

**Base URL:** https://orizon-jet.vercel.app

---

## 9. Dependencies

Node.js **20+** (24.x on Vercel). TypeScript, Fastify 5, Zod, Vitest, `javascript-lp-solver`, Mistral HTTP API (`fetch`). No database.

---

## 10. Known limitations

- Hidden notes may **paraphrase** the same six directive types; do not hard-code public sample wording.
- Regex fallback is keyword-based. Live judging needs `MISTRAL_API_KEY`.
- A 429 cools that key for a few seconds and tries the next key in `MISTRAL_API_KEYS`.
- No grid export. Unused solar is curtailed.
- Docker fallback: `javaman12/gridwise-llm:latest`.
