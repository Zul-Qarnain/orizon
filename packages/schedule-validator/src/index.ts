import {
  HourlyInput,
  BatterySpec,
  DirectiveInterpretation,
  HourlyPlanItem
} from '@gridwise/shared-types';

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSchedule(
  hours: HourlyInput[],
  battery: BatterySpec,
  directives: DirectiveInterpretation[],
  hourlyPlan: HourlyPlanItem[],
  totalGridKwh: number,
  totalCostBdt: number,
  peakGridKwh: number,
  tolerance = 0.01
): ScheduleValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(hourlyPlan) || hourlyPlan.length !== 24) {
    return {
      valid: false,
      errors: ['Hourly plan must contain exactly 24 entries.']
    };
  }

  const hoursByIndex: HourlyInput[] = new Array(24);
  for (const hour of hours) {
    hoursByIndex[hour.hour] = hour;
  }

  // Pre-calculate directive parameters
  const effectiveSolar = new Array(24).fill(0);
  const activeMinEnergy = new Array(24).fill(battery.minimum_energy_kwh);
  const maxChargeRate = new Array(24).fill(battery.max_charge_kwh_per_hour);
  const maxDischargeRate = new Array(24).fill(battery.max_discharge_kwh_per_hour);
  const maxGridCap = new Array(24).fill(Infinity);

  for (let h = 0; h < 24; h++) {
    if (!hoursByIndex[h]) {
      return {
        valid: false,
        errors: [`Missing hour ${h} in input hours array.`]
      };
    }
    effectiveSolar[h] = hoursByIndex[h].solar_kwh;
  }

  for (const d of directives) {
    if (!d.applies || !d.structured_adjustment) continue;

    const adj = d.structured_adjustment as any;
    const targetHours = adj.hours || [];

    switch (d.directive_type) {
      case 'solar_reduction': {
        const factor = adj.factor ?? 1;
        for (const h of targetHours) {
          if (h >= 0 && h < 24) {
            effectiveSolar[h] = hoursByIndex[h].solar_kwh * factor;
          }
        }
        break;
      }
      case 'minimum_battery_reserve': {
        const minReq = adj.minimum_energy_kwh ?? battery.minimum_energy_kwh;
        for (const h of targetHours) {
          if (h >= 0 && h < 24) {
            activeMinEnergy[h] = Math.max(activeMinEnergy[h], minReq);
          }
        }
        break;
      }
      case 'no_charge_window': {
        for (const h of targetHours) {
          if (h >= 0 && h < 24) {
            maxChargeRate[h] = 0;
          }
        }
        break;
      }
      case 'no_discharge_window': {
        for (const h of targetHours) {
          if (h >= 0 && h < 24) {
            maxDischargeRate[h] = 0;
          }
        }
        break;
      }
      case 'max_grid_window': {
        const gridCap = adj.max_grid_kwh ?? Infinity;
        for (const h of targetHours) {
          if (h >= 0 && h < 24) {
            maxGridCap[h] = Math.min(maxGridCap[h], gridCap);
          }
        }
        break;
      }
    }
  }

  let calcTotalGrid = 0;
  let calcTotalCost = 0;
  let calcPeakGrid = 0;

  for (let h = 0; h < 24; h++) {
    const item = hourlyPlan[h];
    if (!item || item.hour !== h) {
      errors.push(`Hour ${h}: missing or out of order plan item.`);
      continue;
    }

    const grid = item.grid_kwh;
    const solarUsed = item.solar_used_kwh;
    const action = item.battery_action;
    const batKwh = item.battery_kwh;
    const energyAfter = item.battery_energy_after_kwh;

    const chargeKwh = action === 'charge' ? batKwh : 0;
    const dischargeKwh = action === 'discharge' ? batKwh : 0;

    if (action === 'idle' && batKwh > tolerance) {
      errors.push(`Hour ${h}: idle battery action with non-zero battery_kwh (${batKwh}).`);
    }

    // 1. Energy balance
    const supply = grid + solarUsed + dischargeKwh;
    const demandAndCharge = hoursByIndex[h].demand_kwh + chargeKwh;
    if (Math.abs(supply - demandAndCharge) > tolerance) {
      errors.push(
        `Hour ${h}: energy balance violated. Supply=${supply.toFixed(2)}, Demand+Charge=${demandAndCharge.toFixed(2)}.`
      );
    }

    // 2. Solar usage cap
    if (solarUsed > effectiveSolar[h] + tolerance) {
      errors.push(
        `Hour ${h}: solar_used_kwh (${solarUsed}) exceeds effective solar limit (${effectiveSolar[h].toFixed(2)}).`
      );
    }

    // 3. Battery state transition
    const energyBefore = h === 0 ? battery.initial_energy_kwh : hourlyPlan[h - 1].battery_energy_after_kwh;
    const expectedEnergyAfter = energyBefore + chargeKwh - dischargeKwh;
    if (Math.abs(energyAfter - expectedEnergyAfter) > tolerance) {
      errors.push(
        `Hour ${h}: battery state transition error. Expected ${expectedEnergyAfter.toFixed(2)}, got ${energyAfter.toFixed(2)}.`
      );
    }

    // 4. Battery bounds
    if (energyAfter < activeMinEnergy[h] - tolerance) {
      errors.push(
        `Hour ${h}: battery energy (${energyAfter}) below active reserve level (${activeMinEnergy[h]}).`
      );
    }
    if (energyAfter > battery.capacity_kwh + tolerance) {
      errors.push(
        `Hour ${h}: battery energy (${energyAfter}) exceeds capacity (${battery.capacity_kwh}).`
      );
    }

    // 5. Rate limits
    if (chargeKwh > maxChargeRate[h] + tolerance) {
      errors.push(
        `Hour ${h}: charge rate (${chargeKwh}) exceeds limit (${maxChargeRate[h]}).`
      );
    }
    if (dischargeKwh > maxDischargeRate[h] + tolerance) {
      errors.push(
        `Hour ${h}: discharge rate (${dischargeKwh}) exceeds limit (${maxDischargeRate[h]}).`
      );
    }

    // 6. Max grid window
    if (grid > maxGridCap[h] + tolerance) {
      errors.push(
        `Hour ${h}: grid import (${grid}) exceeds max grid cap (${maxGridCap[h]}).`
      );
    }

    calcTotalGrid += grid;
    calcTotalCost += grid * hoursByIndex[h].tariff_bdt_per_kwh;
    if (grid > calcPeakGrid) {
      calcPeakGrid = grid;
    }
  }

  // 7. End of day neutrality check
  const finalEnergy = hourlyPlan[23]?.battery_energy_after_kwh ?? 0;
  if (Math.abs(finalEnergy - battery.initial_energy_kwh) > tolerance) {
    errors.push(
      `End-of-day neutrality violated. Expected final energy ${battery.initial_energy_kwh}, got ${finalEnergy}.`
    );
  }

  // 8. Totals check
  if (Math.abs(totalGridKwh - calcTotalGrid) > tolerance) {
    errors.push(
      `total_grid_kwh mismatch: reported ${totalGridKwh}, calculated ${calcTotalGrid.toFixed(2)}.`
    );
  }
  if (Math.abs(totalCostBdt - calcTotalCost) > tolerance) {
    errors.push(
      `total_cost_bdt mismatch: reported ${totalCostBdt}, calculated ${calcTotalCost.toFixed(2)}.`
    );
  }
  if (Math.abs(peakGridKwh - calcPeakGrid) > tolerance) {
    errors.push(
      `peak_grid_kwh mismatch: reported ${peakGridKwh}, calculated ${calcPeakGrid.toFixed(2)}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
