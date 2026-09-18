# GridWise Sample Cases — Test Results

**Date:** September 18, 2026  
**Total Cases:** 10  
**Passed:** 10/10 ✅  
**Failed:** 0 ❌

---

## Summary

| # | Case ID | Label | Status | Total Cost (BDT) | Total Grid (kWh) | Directives |
|---|---------|-------|--------|-------------------|------------------|------------|
| 1 | SAMPLE-01 | Solar cleaning + distractor | ✅ PASS | 38,365 | 2,692.5 | 2 |
| 2 | SAMPLE-02 | Battery charging maintenance | ✅ PASS | 42,885 | 2,915 | 1 |
| 3 | SAMPLE-03 | Emergency reserve as percentage | ✅ PASS | 35,480 | 2,430 | 1 |
| 4 | SAMPLE-04 | No-discharge protection test | ✅ PASS | 40,495 | 2,645 | 1 |
| 5 | SAMPLE-05 | Temporary feeder grid cap | ✅ PASS | 33,950 | 2,430 | 1 |
| 6 | SAMPLE-06 | Multiple notes with distractor | ✅ PASS | 34,090 | 2,395 | 3 |
| 7 | SAMPLE-07 | Reserve plus transformer cap | ✅ PASS | 38,550 | 2,560 | 2 |
| 8 | SAMPLE-08 | Separate charge/discharge outages | ✅ PASS | 37,665 | 2,490 | 2 |
| 9 | SAMPLE-09 | Reduction wording normalization | ✅ PASS | 34,873 | 2,504 | 2 |
| 10 | SAMPLE-10 | Multi-constraint evening operation | ✅ PASS | 41,620 | 2,715 | 3 |

---

## Cost Comparison (Your Output vs Reference)

| Case | Your Cost | Reference Cost | Difference | Within Tolerance? |
|------|-----------|----------------|------------|-------------------|
| SAMPLE-01 | 38,365 | 38,365 | 0 | ✅ Yes |
| SAMPLE-02 | 42,885 | 42,885 | 0 | ✅ Yes |
| SAMPLE-03 | 35,480 | 35,480 | 0 | ✅ Yes |
| SAMPLE-04 | 40,495 | 40,495 | 0 | ✅ Yes |
| SAMPLE-05 | 33,950 | 33,950 | 0 | ✅ Yes |
| SAMPLE-06 | 34,090 | 34,090 | 0 | ✅ Yes |
| SAMPLE-07 | 38,550 | 38,550 | 0 | ✅ Yes |
| SAMPLE-08 | 37,665 | 37,665 | 0 | ✅ Yes |
| SAMPLE-09 | 34,873 | 34,873 | 0 | ✅ Yes |
| SAMPLE-10 | 41,620 | 41,620 | 0 | ✅ Yes |

---

## Directive Type Coverage

| Directive Type | Cases Tested | Status |
|----------------|--------------|--------|
| `solar_reduction` | SAMPLE-01, 06, 09 | ✅ Working |
| `minimum_battery_reserve` | SAMPLE-03, 07, 10 | ✅ Working |
| `no_charge_window` | SAMPLE-02, 06, 08 | ✅ Working |
| `no_discharge_window` | SAMPLE-04, 08, 10 | ✅ Working |
| `max_grid_window` | SAMPLE-05, 07, 10 | ✅ Working |
| `no_op` (distractor) | SAMPLE-01, 06, 09 | ✅ Working |

---

## Constraints Validated

| Constraint | Status |
|------------|--------|
| Energy balance (grid + solar + discharge = demand + charge) | ✅ |
| Battery SOC transitions | ✅ |
| Battery min/max bounds | ✅ |
| Charge/discharge rate limits | ✅ |
| Solar cap enforcement | ✅ |
| End-of-day neutrality (battery returns to initial) | ✅ |
| Grid cap enforcement | ✅ |
| Total cost recomputation matches | ✅ |
| Total grid recomputation matches | ✅ |
| Peak grid recomputation matches | ✅ |

---

## Conclusion

**ALL 10 PUBLIC SAMPLE CASES PASS** ✅

- Correct directive interpretation for all 6 directive types
- Optimal cost matching reference schedules
- All physical constraints satisfied
- End-of-day battery neutrality maintained
- Distractor notes correctly handled as `no_op`

**Ready for deployment to Vercel.**
