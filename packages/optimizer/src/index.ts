import solver from 'javascript-lp-solver';
import {
  HourlyInput,
  BatterySpec,
  DirectiveInterpretation,
  HourlyPlanItem
} from '@gridwise/shared-types';

export interface OptimizationResult {
  hourly_plan: HourlyPlanItem[];
  total_grid_kwh: number;
  total_cost_bdt: number;
  peak_grid_kwh: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function indexHours(hours: HourlyInput[]): HourlyInput[] {
  const indexed: HourlyInput[] = new Array(24);
  for (const hour of hours) {
    indexed[hour.hour] = hour;
  }
  for (let h = 0; h < 24; h++) {
    if (!indexed[h]) {
      throw new Error(`Missing hour ${h} in input hours array.`);
    }
  }
  return indexed;
}

export function optimizeSchedule(
  hours: HourlyInput[],
  battery: BatterySpec,
  directives: DirectiveInterpretation[]
): OptimizationResult {
  const hourly = indexHours(hours);

  // 1. Calculate effective parameters per hour
  const effectiveSolar = new Array(24).fill(0);
  const activeMinEnergy = new Array(24).fill(battery.minimum_energy_kwh);
  const maxChargeRate = new Array(24).fill(battery.max_charge_kwh_per_hour);
  const maxDischargeRate = new Array(24).fill(battery.max_discharge_kwh_per_hour);
  const maxGridCap = new Array(24).fill(Infinity);

  for (let h = 0; h < 24; h++) {
    effectiveSolar[h] = hourly[h].solar_kwh;
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
            effectiveSolar[h] = hourly[h].solar_kwh * factor;
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

  // 2. Build LP Model
  const model: any = {
    optimize: 'cost',
    opType: 'min',
    constraints: {},
    variables: {}
  };

  // End of day neutrality constraint
  model.constraints['end_neutrality'] = { equal: battery.initial_energy_kwh };

  for (let h = 0; h < 24; h++) {
    // Energy balance
    model.constraints[`balance_${h}`] = { equal: hourly[h].demand_kwh };

    // Battery SOC bounds
    model.constraints[`soc_${h}`] = {
      min: activeMinEnergy[h],
      max: battery.capacity_kwh
    };

    // State transition link
    if (h === 0) {
      model.constraints[`soc_link_0`] = { equal: battery.initial_energy_kwh };
    } else {
      model.constraints[`soc_link_${h}`] = { equal: 0 };
    }

    // Caps
    model.constraints[`solar_cap_${h}`] = { max: effectiveSolar[h] };
    model.constraints[`charge_cap_${h}`] = { max: maxChargeRate[h] };
    model.constraints[`discharge_cap_${h}`] = { max: maxDischargeRate[h] };

    if (maxGridCap[h] !== Infinity) {
      model.constraints[`grid_cap_${h}`] = { max: maxGridCap[h] };
    }

    // Variables
    // Grid import g_h
    const gridVar: any = {
      cost: hourly[h].tariff_bdt_per_kwh,
      [`balance_${h}`]: 1
    };
    if (maxGridCap[h] !== Infinity) {
      gridVar[`grid_cap_${h}`] = 1;
    }
    model.variables[`g_${h}`] = gridVar;

    // Solar s_h
    model.variables[`s_${h}`] = {
      cost: 0,
      [`balance_${h}`]: 1,
      [`solar_cap_${h}`]: 1
    };

    // Charge c_h
    const chargeVar: any = {
      cost: 0,
      [`balance_${h}`]: -1,
      [`charge_cap_${h}`]: 1,
      [`soc_link_${h}`]: -1
    };
    model.variables[`c_${h}`] = chargeVar;

    // Discharge d_h
    const dischargeVar: any = {
      cost: 0,
      [`balance_${h}`]: 1,
      [`discharge_cap_${h}`]: 1,
      [`soc_link_${h}`]: 1
    };
    model.variables[`d_${h}`] = dischargeVar;

    // Energy level e_h
    const socVar: any = {
      cost: 0,
      [`soc_${h}`]: 1,
      [`soc_link_${h}`]: 1
    };
    if (h < 23) {
      socVar[`soc_link_${h + 1}`] = -1;
    } else {
      socVar['end_neutrality'] = 1;
    }
    model.variables[`e_${h}`] = socVar;
  }

  // 3. Solve LP
  const solveFn = (solver as any).solve || (solver as any).Solve;
  const solution: any = solveFn.call(solver, model);

  if (!solution || !solution.feasible) {
    throw new Error('Infeasible energy optimization scenario under given directives and constraints.');
  }

  // 4. Extract schedule at 2-decimal precision with exact energy balance
  const hourly_plan: HourlyPlanItem[] = [];
  let total_grid_kwh = 0;
  let total_cost_bdt = 0;
  let peak_grid_kwh = 0;
  let energy = battery.initial_energy_kwh;

  for (let h = 0; h < 24; h++) {
    const rawSolar = solution[`s_${h}`] || 0;
    const rawCharge = solution[`c_${h}`] || 0;
    const rawDischarge = solution[`d_${h}`] || 0;

    let charge = Math.max(0, round2(rawCharge));
    let discharge = Math.max(0, round2(rawDischarge));
    if (charge > 0 && discharge > 0) {
      const net = round2(charge - discharge);
      charge = net > 0 ? net : 0;
      discharge = net < 0 ? round2(-net) : 0;
    }
    if (charge <= 0.005) charge = 0;
    if (discharge <= 0.005) discharge = 0;

    let solar = Math.max(0, round2(rawSolar));
    if (solar > effectiveSolar[h]) {
      solar = round2(effectiveSolar[h]);
    }

    energy = round2(energy + charge - discharge);

    if (h === 23) {
      const target = round2(battery.initial_energy_kwh);
      const drift = round2(energy - target);
      if (drift !== 0 && Math.abs(drift) <= 0.05) {
        if (drift > 0) {
          if (charge >= drift) charge = round2(charge - drift);
          else discharge = round2(discharge + drift);
        } else {
          const need = round2(-drift);
          if (discharge >= need) discharge = round2(discharge - need);
          else charge = round2(charge + need);
        }
        if (charge <= 0.005) charge = 0;
        if (discharge <= 0.005) discharge = 0;
        energy = target;
      }
    }

    const grid = round2(Math.max(0, hourly[h].demand_kwh + charge - solar - discharge));

    let battery_action: 'charge' | 'discharge' | 'idle' = 'idle';
    let battery_kwh = 0;
    if (charge > 0) {
      battery_action = 'charge';
      battery_kwh = charge;
    } else if (discharge > 0) {
      battery_action = 'discharge';
      battery_kwh = discharge;
    }

    hourly_plan.push({
      hour: h,
      grid_kwh: grid,
      solar_used_kwh: solar,
      battery_action,
      battery_kwh,
      battery_energy_after_kwh: energy
    });

    total_grid_kwh += grid;
    total_cost_bdt += grid * hourly[h].tariff_bdt_per_kwh;
    if (grid > peak_grid_kwh) {
      peak_grid_kwh = grid;
    }
  }

  total_grid_kwh = Math.round(total_grid_kwh * 100) / 100;
  total_cost_bdt = Math.round(total_cost_bdt * 100) / 100;
  peak_grid_kwh = Math.round(peak_grid_kwh * 100) / 100;

  return {
    hourly_plan,
    total_grid_kwh,
    total_cost_bdt,
    peak_grid_kwh
  };
}
