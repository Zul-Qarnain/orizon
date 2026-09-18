import { describe, it, expect } from 'vitest';
import { optimizeSchedule } from '../../packages/optimizer/src/index.js';
import { HourlyInput } from '../../packages/shared-types/src/index.js';

describe('Optimizer Unit Tests', () => {
  const dummyHours: HourlyInput[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    demand_kwh: 100,
    solar_kwh: i >= 8 && i <= 16 ? 50 : 0,
    tariff_bdt_per_kwh: i >= 17 && i <= 21 ? 20 : 5
  }));

  const dummyBattery = {
    capacity_kwh: 200,
    initial_energy_kwh: 100,
    minimum_energy_kwh: 20,
    max_charge_kwh_per_hour: 50,
    max_discharge_kwh_per_hour: 50
  };

  it('should optimize grid cost with no directives', () => {
    const result = optimizeSchedule(dummyHours, dummyBattery, []);
    expect(result.hourly_plan).toHaveLength(24);
    expect(result.total_cost_bdt).toBeGreaterThan(0);
    expect(result.total_grid_kwh).toBeGreaterThan(0);
  });

  it('should optimize even when hours array is not in hour order', () => {
    const shuffled = [...dummyHours].reverse();
    const result = optimizeSchedule(shuffled, dummyBattery, []);
    expect(result.hourly_plan).toHaveLength(24);
    expect(result.hourly_plan[0].hour).toBe(0);
    expect(result.hourly_plan[23].hour).toBe(23);
    expect(result.hourly_plan[23].battery_energy_after_kwh).toBe(dummyBattery.initial_energy_kwh);
  });

  it('should obey no_charge_window directive', () => {
    const directives: any[] = [
      {
        note_index: 0,
        applies: true,
        directive_type: 'no_charge_window',
        structured_adjustment: { hours: [2, 3, 4] },
        explanation: 'No charge allowed'
      }
    ];

    const result = optimizeSchedule(dummyHours, dummyBattery, directives);
    for (const h of [2, 3, 4]) {
      const planItem = result.hourly_plan[h];
      expect(planItem.battery_action).not.toBe('charge');
    }
  });
});
