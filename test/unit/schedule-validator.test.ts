import { describe, it, expect } from 'vitest';
import { validateSchedule } from '../../packages/schedule-validator/src/index.js';

describe('Schedule Validator Unit Tests', () => {
  const dummyHours: any[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    demand_kwh: 100,
    solar_kwh: 0,
    tariff_bdt_per_kwh: 10
  }));

  const dummyBattery = {
    capacity_kwh: 200,
    initial_energy_kwh: 100,
    minimum_energy_kwh: 20,
    max_charge_kwh_per_hour: 50,
    max_discharge_kwh_per_hour: 50
  };

  it('should pass valid flat schedule', () => {
    const hourlyPlan: any[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      grid_kwh: 100,
      solar_used_kwh: 0,
      battery_action: 'idle',
      battery_kwh: 0,
      battery_energy_after_kwh: 100
    }));

    const result = validateSchedule(
      dummyHours,
      dummyBattery,
      [],
      hourlyPlan,
      2400,
      24000,
      100
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when energy balance is violated', () => {
    const hourlyPlan: any[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      grid_kwh: 50, // Demand is 100! Missing 50 kWh!
      solar_used_kwh: 0,
      battery_action: 'idle',
      battery_kwh: 0,
      battery_energy_after_kwh: 100
    }));

    const result = validateSchedule(
      dummyHours,
      dummyBattery,
      [],
      hourlyPlan,
      1200,
      12000,
      50
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
