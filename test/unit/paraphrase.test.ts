import { describe, it, expect } from 'vitest';
import { parseNotesDeterministic } from '../../packages/llm-interpreter/src/index.js';

const battery = {
  capacity_kwh: 200,
  initial_energy_kwh: 100,
  minimum_energy_kwh: 40,
  max_charge_kwh_per_hour: 50,
  max_discharge_kwh_per_hour: 50
};

describe('Paraphrased operator notes', () => {
  it('maps remaining-fraction solar wording', () => {
    const [note] = parseNotesDeterministic(
      ['Treat rooftop output as 25% of forecast from noon until 2 PM during panel washing.'],
      battery
    );
    expect(note.directive_type).toBe('solar_reduction');
    expect(note.applies).toBe(true);
    expect(note.structured_adjustment.hours).toEqual([12, 13]);
    expect(note.structured_adjustment.factor).toBeCloseTo(0.25, 2);
  });

  it('maps percent reserve into kWh', () => {
    const [note] = parseNotesDeterministic(
      ['Keep at least 50% of capacity stored in the battery from 6 PM until 9 PM.'],
      battery
    );
    expect(note.directive_type).toBe('minimum_battery_reserve');
    expect(note.structured_adjustment.hours).toEqual([18, 19, 20]);
    expect(note.structured_adjustment.minimum_energy_kwh).toBeCloseTo(100, 2);
  });

  it('maps charger isolation as no-charge', () => {
    const [note] = parseNotesDeterministic(
      ['The battery charger will be isolated from 2 AM until 5 AM for electrical maintenance.'],
      battery
    );
    expect(note.directive_type).toBe('no_charge_window');
    expect(note.structured_adjustment.hours).toEqual([2, 3, 4]);
  });

  it('maps protection testing as no-discharge', () => {
    const [note] = parseNotesDeterministic(
      ['For protection testing, the battery must not discharge from 6 PM until 8 PM.'],
      battery
    );
    expect(note.directive_type).toBe('no_discharge_window');
    expect(note.structured_adjustment.hours).toEqual([18, 19]);
  });

  it('maps feeder limit as max grid window', () => {
    const [note] = parseNotesDeterministic(
      ['From 6 PM until 9 PM, campus grid import must not exceed 155 kWh in any hour because the feeder is operating under a temporary limit.'],
      battery
    );
    expect(note.directive_type).toBe('max_grid_window');
    expect(note.structured_adjustment.hours).toEqual([18, 19, 20]);
    expect(note.structured_adjustment.max_grid_kwh).toBe(155);
  });

  it('maps unrelated campus notes as no_op', () => {
    const [note] = parseNotesDeterministic(
      ['The student affairs office will publish club notices tomorrow.'],
      battery
    );
    expect(note.directive_type).toBe('no_op');
    expect(note.applies).toBe(false);
    expect(note.structured_adjustment).toBeNull();
  });
});
