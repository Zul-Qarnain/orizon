# GridWise Live Endpoint Test

**Date:** 2026-09-18 16:13 UTC
**Base URL:** https://orizon-jet.vercel.app
**LLM:** Mistral only (`mistral-small-latest`). Gemini removed.

Warmup `/health`: 0.822s then 0.504s

| ID | Status | Time (s) | Cost (BDT) | Reference | Peak kWh | Directives |
|---|---|---|---|---|---|---|
| SAMPLE-01 | PASS | 1.005 | 38365 | 38365 | 187.5 | solar_reduction, no_op |
| SAMPLE-02 | PASS | 0.516 | 42885 | 42885 | 180 | no_charge_window |
| SAMPLE-03 | PASS | 0.283 | 35480 | 35480 | 205 | minimum_battery_reserve |
| SAMPLE-04 | PASS | 0.265 | 40495 | 40495 | 225 | no_discharge_window |
| SAMPLE-05 | PASS | 0.308 | 33950 | 33950 | 175 | max_grid_window |
| SAMPLE-06 | PASS | 0.294 | 34090 | 34090 | 175 | solar_reduction, no_charge_window, no_op |
| SAMPLE-07 | PASS | 0.291 | 38550 | 38550 | 185 | minimum_battery_reserve, max_grid_window |
| SAMPLE-08 | PASS | 0.324 | 37665 | 37665 | 210 | no_charge_window, no_discharge_window |
| SAMPLE-09 | PASS | 1.866 | 34873 | 34873 | 187 | solar_reduction, no_op |
| SAMPLE-10 | PASS | 0.367 | 41620 | 41620 | 190 | minimum_battery_reserve, max_grid_window, no_op |

## Scorecard

- Passed: **10/10**
- Min latency: **0.265s**
- Avg latency: **0.552s**
- Max latency: **1.866s**
- Over 5s: **0**
- Over 30s: **0**
- Costs: **10/10 match** public references
