# GridWise LLM — Campus Energy Optimization API

BUP CSE Fest 2026 preliminary. **Mistral only.** Stateless Fastify service: natural-language operator notes → structured directives → cost-minimizing 24-hour campus energy plan.

**Live judge URL (no auth, no VPN):** https://orizon-jet.vercel.app

On-site API docs: https://orizon-jet.vercel.app/#api-docs

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | `{ "status": "ok" }` |
| `POST` | `/optimize-energy` | Full pipeline. JSON in, JSON out |
| `GET` | `/` | Optional dashboard for humans |

```bash
curl -s https://orizon-jet.vercel.app/health
# {"status":"ok"}
```

`POST /optimize-energy` with SAMPLE-01 should return HTTP 200, `solar_reduction` hours `[12,13]` factor `0.25`, second note `no_op`, 24-row `hourly_plan`, `total_cost_bdt` near **38365**.

---

## How the API works (judging path)

The judge only needs the two contract endpoints. One request does this, in order:

1. **Validate** the body with Zod (`scenario_id`, 1–3 `operator_notes`, 24 `hours`, `battery`).
2. **Interpret notes with Mistral** (`mistral-small-latest`, JSON mode). This is on the real interpretation path, not just `plan_summary`. Extra keys in `MISTRAL_API_KEYS` are tried on 429. If Mistral times out (~1.4s) or returns junk, a deterministic parser fills that note. Repeat notes are cached in-memory on a warm instance.
3. **Guardrails** treat LLM JSON as untrusted: allowed `directive_type` only, unique hours `0..23` ascending, start-inclusive / end-exclusive, `factor` in `[0,1]`. Invalid items become `no_op`.
4. **Optimize** a 24-hour LP with `javascript-lp-solver`: minimize `Σ grid_kwh[h] * tariff`. Energy balance, battery SOC/rates, solar cap, grid cap, end-of-day neutrality.
5. **Replay-validate** the plan at 0.01 tolerance. Return the JSON response (or 500 if the plan is internally inconsistent).

Hours are **start-inclusive, end-exclusive**. `"noon until 2 PM"` → `[12, 13]`. `solar_reduction.factor` is the **remaining** solar fraction (`80% reduction` → `0.2`).

### Directive types

| `directive_type` | `structured_adjustment` |
|---|---|
| `solar_reduction` | `{ hours, factor }` |
| `minimum_battery_reserve` | `{ hours, minimum_energy_kwh }` |
| `no_charge_window` | `{ hours }` |
| `no_discharge_window` | `{ hours }` |
| `max_grid_window` | `{ hours, max_grid_kwh }` |
| `no_op` | `null` (distractor / not today's schedule) |

---

## How the project is structured

```
packages/shared-types          Zod request/response/directive contracts
packages/llm-interpreter       Mistral HTTP client + regex fallback
packages/guardrails            Deterministic sanitizer
packages/optimizer             24-hour LP
packages/schedule-validator    Independent replay of the returned plan
packages/api                   Fastify: /health and /optimize-energy
api/index.ts                   Vercel serverless entry
```

No database. No Gemini. LLM → guardrails → optimizer → validator is four separate packages, not one model call.

---

## Environment

Copy `.env.example` to `.env.local` (never commit secrets):

```bash
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_API_KEYS=optional_second_key,optional_third_key
MISTRAL_MODEL=mistral-small-latest
HOST=0.0.0.0
PORT=3000
```

Live endpoint must have `MISTRAL_API_KEY` so hidden paraphrases are not regex-only. Do not log or return the key.

---

## Local run and tests

```bash
git clone https://github.com/Zul-Qarnain/orizon.git
cd orizon
npm install
npm run build
npm test
npm start
```

`npm test` runs unit tests plus all 10 public cases in `problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json`.

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

Dashboard: `http://127.0.0.1:3000` (pick SAMPLE-01, Run).

---

## Docker fallback

Pullable image (public): **`javaman12/gridwise-llm:latest`**

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

Binds `0.0.0.0:3000`. No secrets in the image — pass the Mistral key at run time. Hub: https://hub.docker.com/r/javaman12/gridwise-llm

---

## Live deploy (Vercel)

Host: **Vercel** (`cdg1`), because it is public HTTPS with no login. Hobby `maxDuration` is 30s. Entrypoint `api/index.ts`.

```bash
npx vercel --prod
```

Set `MISTRAL_API_KEY` / `MISTRAL_API_KEYS` / `MISTRAL_MODEL` in the Vercel project. Ping `/health` during judging so the Hobby function stays warm.

**Base URL:** https://orizon-jet.vercel.app

---

## Known limitations

- Docker fallback image: `javaman12/gridwise-llm:latest` (public on Docker Hub).
- No database.
- Regex fallback is keyword-based; hidden paraphrases need the live Mistral key.
- Mistral 429s skip that key for ~25s and try the next key.

## Dependencies

Node.js ≥ 20. TypeScript, Fastify 5, Zod, Vitest, `javascript-lp-solver`, Mistral HTTP API (`fetch`).
