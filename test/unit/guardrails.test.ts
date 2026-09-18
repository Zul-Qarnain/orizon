import { describe, it, expect } from 'vitest';
import { validateAndSanitizeDirectives } from '../../packages/guardrails/src/index.js';

describe('Guardrails Unit Tests', () => {
  const dummyBattery = {
    capacity_kwh: 500,
    initial_energy_kwh: 200,
    minimum_energy_kwh: 50,
    max_charge_kwh_per_hour: 100,
    max_discharge_kwh_per_hour: 100
  };

  it('should accept valid solar_reduction directive', () => {
    const raw = [
      {
        note_index: 0,
        applies: true,
        directive_type: 'solar_reduction',
        structured_adjustment: { hours: [13, 14], factor: 0.2 },
        explanation: 'Panel cleaning'
      }
    ];

    const result = validateAndSanitizeDirectives(raw, ['Clean panels'], dummyBattery);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      note_index: 0,
      applies: true,
      directive_type: 'solar_reduction',
      structured_adjustment: { hours: [13, 14], factor: 0.2 },
      explanation: 'Panel cleaning'
    });
  });

  it('should fallback invalid directive types to no_op', () => {
    const raw = [
      {
        note_index: 0,
        applies: true,
        directive_type: 'invalid_type_name',
        structured_adjustment: { hours: [1, 2] },
        explanation: 'Hacked'
      }
    ];

    const result = validateAndSanitizeDirectives(raw, ['Hacked note'], dummyBattery);
    expect(result[0].directive_type).toBe('no_op');
    expect(result[0].applies).toBe(false);
    expect(result[0].structured_adjustment).toBeNull();
  });

  it('should sanitize out-of-order hours and deduplicate them', () => {
    const raw = [
      {
        note_index: 0,
        applies: true,
        directive_type: 'no_charge_window',
        structured_adjustment: { hours: [15, 12, 12, 10] },
        explanation: 'Maintenance'
      }
    ];

    const result = validateAndSanitizeDirectives(raw, ['Maintenance note'], dummyBattery);
    expect(result[0].structured_adjustment?.hours).toEqual([10, 12, 15]);
  });
});
