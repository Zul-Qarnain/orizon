import {
  DirectiveInterpretation,
  DirectiveType,
  BatterySpec
} from '@gridwise/shared-types';

export function validateAndSanitizeDirectives(
  rawInterpretations: any[],
  operatorNotes: string[],
  batterySpec: BatterySpec
): DirectiveInterpretation[] {
  const result: DirectiveInterpretation[] = [];

  for (let i = 0; i < operatorNotes.length; i++) {
    const raw = Array.isArray(rawInterpretations)
      ? rawInterpretations.find((item: any) => item && item.note_index === i) || rawInterpretations[i]
      : null;

    const sanitized = validateSingleDirective(raw, i, batterySpec);
    result.push(sanitized);
  }

  return result;
}

function validateSingleDirective(
  raw: any,
  expectedIndex: number,
  batterySpec: BatterySpec
): DirectiveInterpretation {
  const fallbackNoOp: DirectiveInterpretation = {
    note_index: expectedIndex,
    applies: false,
    directive_type: 'no_op',
    structured_adjustment: null,
    explanation: 'Unrecognized or invalid note content treated as no-op.'
  };

  if (!raw || typeof raw !== 'object') {
    return fallbackNoOp;
  }

  const allowedTypes: DirectiveType[] = [
    'solar_reduction',
    'minimum_battery_reserve',
    'no_charge_window',
    'no_discharge_window',
    'max_grid_window',
    'no_op'
  ];

  let directive_type = raw.directive_type;
  if (!allowedTypes.includes(directive_type)) {
    return fallbackNoOp;
  }

  let applies = Boolean(raw.applies);
  let explanation = typeof raw.explanation === 'string' && raw.explanation.trim().length > 0
    ? raw.explanation.trim()
    : 'Operator directive interpreted.';

  if (directive_type === 'no_op') {
    return {
      note_index: expectedIndex,
      applies: false,
      directive_type: 'no_op',
      structured_adjustment: null,
      explanation
    };
  }

  // Any non-no_op directive MUST have applies: true
  applies = true;

  const adj = raw.structured_adjustment;
  if (!adj || typeof adj !== 'object') {
    return fallbackNoOp;
  }

  // Validate hours array
  let hours: number[] = [];
  if (Array.isArray(adj.hours)) {
    hours = adj.hours
      .map((h: any) => Number(h))
      .filter((h: number) => Number.isInteger(h) && h >= 0 && h <= 23);
    // deduplicate and sort ascending
    hours = Array.from(new Set(hours)).sort((a, b) => a - b);
  }

  if (hours.length === 0) {
    // A window directive with 0 valid hours is useless / invalid
    return fallbackNoOp;
  }

  let sanitizedAdj: any = { hours };

  switch (directive_type) {
    case 'solar_reduction': {
      let factor = Number(adj.factor);
      if (isNaN(factor) || factor < 0 || factor > 1) {
        return fallbackNoOp;
      }
      // round factor to 4 decimal places if needed
      sanitizedAdj.factor = Math.round(factor * 10000) / 10000;
      break;
    }
    case 'minimum_battery_reserve': {
      let minVal = Number(adj.minimum_energy_kwh);
      if (isNaN(minVal) || minVal < 0 || minVal > batterySpec.capacity_kwh) {
        return fallbackNoOp;
      }
      sanitizedAdj.minimum_energy_kwh = Math.round(minVal * 100) / 100;
      break;
    }
    case 'no_charge_window':
    case 'no_discharge_window': {
      // hours only
      break;
    }
    case 'max_grid_window': {
      let maxGrid = Number(adj.max_grid_kwh);
      if (isNaN(maxGrid) || maxGrid < 0) {
        return fallbackNoOp;
      }
      sanitizedAdj.max_grid_kwh = Math.round(maxGrid * 100) / 100;
      break;
    }
    default:
      return fallbackNoOp;
  }

  return {
    note_index: expectedIndex,
    applies: true,
    directive_type,
    structured_adjustment: sanitizedAdj,
    explanation
  };
}
