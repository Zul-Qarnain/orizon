import { describe, it, expect } from 'vitest';
import { parseNotesDeterministic } from '../../packages/llm-interpreter/src/index.js';

const battery = {
  capacity_kwh: 220,
  initial_energy_kwh: 110,
  minimum_energy_kwh: 40,
  max_charge_kwh_per_hour: 50,
  max_discharge_kwh_per_hour: 50
};

describe('Deterministic note parser', () => {
  it('parses solar remaining-fraction and distractor notes', () => {
    const result = parseNotesDeterministic(
      [
        'Facilities will wash the rooftop solar panels from noon until 2 PM. During cleaning, usable solar should be treated as roughly 25% of the forecast.',
        'The sports office moved next month\'s registration deadline.'
      ],
      battery
    );

    expect(result[0].directive_type).toBe('solar_reduction');
    expect(result[0].structured_adjustment.hours).toEqual([12, 13]);
    expect(result[0].structured_adjustment.factor).toBeCloseTo(0.25, 2);
    expect(result[1].directive_type).toBe('no_op');
  });

  it('parses reduction-by-percent wording and dashed clock ranges', () => {
    const result = parseNotesDeterministic(
      ['Reduce rooftop solar by 80% between 11 AM and 2 PM.', 'Charger isolated 2am-5am for maintenance.'],
      battery
    );

    expect(result[0].directive_type).toBe('solar_reduction');
    expect(result[0].structured_adjustment.factor).toBeCloseTo(0.2, 2);
    expect(result[0].structured_adjustment.hours).toEqual([11, 12, 13]);
    expect(result[1].directive_type).toBe('no_charge_window');
    expect(result[1].structured_adjustment.hours).toEqual([2, 3, 4]);
  });
});
