import { BatterySpec, DirectiveInterpretation } from '@gridwise/shared-types';

export interface InterpretNotesParams {
  operator_notes: string[];
  battery: BatterySpec;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

const keyCooldownUntil = new Map<string, number>();
const providerCooldownUntil = new Map<string, number>();

export async function interpretOperatorNotes(
  params: InterpretNotesParams
): Promise<any[]> {
  const {
    operator_notes,
    battery,
    apiKey,
    model = process.env.MISTRAL_MODEL || 'mistral-small-latest',
    timeoutMs = 3500
  } = params;

  const fallback = parseNotesDeterministic(operator_notes, battery);
  const mistralKeys = collectEnvKeys(apiKey, process.env.MISTRAL_API_KEY, process.env.MISTRAL_API_KEYS);
  const deadline = Date.now() + timeoutMs;

  const mistralMerged = await tryKeyRing(
    'Mistral',
    mistralKeys,
    (key, remaining) => callMistralApi(operator_notes, battery, key, model, remaining),
    operator_notes.length,
    fallback,
    deadline
  );
  if (mistralMerged) return mistralMerged;

  return fallback;
}

function collectEnvKeys(...groups: Array<string | undefined>): string[] {
  const raw = groups.flatMap((group) => (group || '').split(/[,;\n]+/));
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const part of raw) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function cooldownMsFor(msg: string): number {
  if (/HTTP 401|HTTP 403/.test(msg)) return 10 * 60_000;
  if (/HTTP 429/.test(msg)) return 25_000;
  if (/HTTP 503/.test(msg)) return 8_000;
  if (/HTTP 5\d\d/.test(msg)) return 5_000;
  if (/aborted|AbortError|timeout/i.test(msg)) return 20_000;
  return 0;
}

function markCooldown(label: string, key: string, msg: string, remainingKeys: number): void {
  const ms = cooldownMsFor(msg);
  if (!ms) return;
  keyCooldownUntil.set(key, Date.now() + ms);
  const coolProvider = remainingKeys <= 0 || /aborted|AbortError|timeout/i.test(msg);
  if (coolProvider) {
    providerCooldownUntil.set(label, Date.now() + Math.min(ms, 20_000));
  }
}

function isCooling(id: string, table: Map<string, number>): boolean {
  const until = table.get(id) || 0;
  if (!until) return false;
  if (Date.now() >= until) {
    table.delete(id);
    return false;
  }
  return true;
}

async function tryKeyRing(
  label: string,
  keys: string[],
  callApi: (key: string, remaining: number) => Promise<any[]>,
  expectedLen: number,
  fallback: any[],
  deadline: number
): Promise<any[] | null> {
  if (isCooling(label, providerCooldownUntil)) {
    return null;
  }
  const usable = keys.filter((key) => !isCooling(key, keyCooldownUntil));
  if (usable.length === 0) return null;

  for (let i = 0; i < usable.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 250) break;
    const key = usable[i];
    try {
      const llmResult = await callApi(key, remaining);
      if (Array.isArray(llmResult) && llmResult.length === expectedLen) {
        return llmResult.map((item, idx) => (isUsableLlmItem(item) ? item : fallback[idx]));
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      markCooldown(label, key, msg, usable.length - i - 1);
      const tryNext = /HTTP 429|HTTP 401|HTTP 403|HTTP 404|HTTP 5\d\d/.test(msg);
      if (tryNext && i < usable.length - 1) {
        console.warn(`${label} key ${i + 1}/${usable.length} failed (${msg.split(':')[0]}). Trying next key.`);
        continue;
      }
      console.warn(`${label} interpretation failed (${msg.split(':')[0] || msg}).`);
      break;
    }
  }
  return null;
}

function buildLlmPrompt(operatorNotes: string[], battery: BatterySpec): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `Interpret campus operator notes into JSON {"interpretations":[...]} — one object per note, note_index 0..${operatorNotes.length - 1}.
Fields: note_index, applies, directive_type, structured_adjustment, explanation.
Types:
- solar_reduction {hours, factor} factor=REMAINING fraction (80% reduction=>0.2; "25% of forecast"=>0.25; half=>0.5)
- minimum_battery_reserve {hours, minimum_energy_kwh} convert % using capacity ${battery.capacity_kwh} kWh
- no_charge_window {hours}
- no_discharge_window {hours}
- max_grid_window {hours, max_grid_kwh}
- no_op applies=false structured_adjustment=null
Hours: unique ints 0-23 ascending, start-inclusive/end-exclusive. noon-2PM=[12,13]; 2AM-5AM=[2,3,4]; 6PM-9PM=[18,19,20]; 11AM-2PM=[11,12,13].
applies=true except no_op. Distractors=no_op. Do not invent demand/tariff/battery limits.`;

  const userPrompt = `Operator Notes to interpret:
${operatorNotes.map((note, idx) => `[Note ${idx}]: "${note}"`).join('\n')}`;
  return { systemPrompt, userPrompt };
}

function isUsableLlmItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const allowed = [
    'solar_reduction',
    'minimum_battery_reserve',
    'no_charge_window',
    'no_discharge_window',
    'max_grid_window',
    'no_op'
  ];
  if (!allowed.includes(item.directive_type)) return false;
  if (item.directive_type === 'no_op') return true;
  const hours = item.structured_adjustment?.hours;
  return Array.isArray(hours) && hours.length > 0;
}

async function callMistralApi(
  operatorNotes: string[],
  battery: BatterySpec,
  apiKey: string,
  model: string,
  timeoutMs: number
): Promise<any[]> {
  const { systemPrompt, userPrompt } = buildLlmPrompt(operatorNotes, battery);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.0,
        max_tokens: 512,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response content from Mistral API');
    }
    return parseInterpretationPayload(content);
  } finally {
    clearTimeout(timer);
  }
}

function parseInterpretationPayload(content: string): any[] {
  const trimmed = content.trim();
  const jsonText =
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? trimmed
      : (trimmed.match(/\{[\s\S]*\}/) || [trimmed])[0];
  const parsed = JSON.parse(jsonText);
  return parsed.interpretations || parsed.directive_interpretation || parsed;
}

export function parseNotesDeterministic(
  operatorNotes: string[],
  battery: BatterySpec
): any[] {
  return operatorNotes.map((note, idx) => parseSingleNoteDeterministic(note, idx, battery));
}

function parseSingleNoteDeterministic(
  note: string,
  noteIndex: number,
  battery: BatterySpec
): any {
  const text = note.toLowerCase();
  const hours = extractHoursFromText(text);

  // Distractor filter: notes about sports, registration, library books, student affairs, seminars, etc.
  if (
    text.includes('sports office') ||
    text.includes('library') ||
    text.includes('student affairs') ||
    text.includes('seminar room') ||
    text.includes('registration deadline') ||
    text.includes('club notices') ||
    text.includes('book-return')
  ) {
    return createNoOp(noteIndex);
  }

  // 1. Solar Reduction
  if (
    (text.includes('solar') || text.includes('rooftop') || text.includes('cloud')) &&
    hours.length > 0
  ) {
    let factor = 1.0;

    const redMatch = text.match(/(\d+)\s*%\s*reduction/)
      || text.match(/(?:reduc(?:e|ed|ing)|cut)\b[\s\S]{0,48}?\b(?:by\s+)?(\d+)\s*%/);
    const fracMatch = text.match(/(\d+)\s*%\s*of/);

    if (redMatch) {
      const pct = parseFloat(redMatch[1]);
      factor = Math.max(0, (100 - pct) / 100);
    } else if (fracMatch) {
      const pct = parseFloat(fracMatch[1]);
      factor = Math.min(1, pct / 100);
    } else if (text.includes('half')) {
      factor = 0.5;
    }

    return {
      note_index: noteIndex,
      applies: true,
      directive_type: 'solar_reduction',
      structured_adjustment: {
        hours,
        factor: Math.round(factor * 100) / 100
      },
      explanation: `Solar availability is reduced to ${(factor * 100).toFixed(0)}% in hours ${hours.join(', ')}.`
    };
  }

  // 2. Minimum Battery Reserve
  if (
    (text.includes('reserve') ||
      text.includes('stored in the battery') ||
      text.includes('remain in the battery') ||
      text.includes('keep at least') ||
      text.includes('requires at least') ||
      text.includes('in the battery')) &&
    hours.length > 0
  ) {
    let minKwh = battery.minimum_energy_kwh;

    const pctMatch = text.match(/(\d+)%\s*of/);
    const kwhMatch = text.match(/(\d+)\s*kwh/);

    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      minKwh = (pct / 100) * battery.capacity_kwh;
    } else if (kwhMatch) {
      minKwh = parseFloat(kwhMatch[1]);
    }

    return {
      note_index: noteIndex,
      applies: true,
      directive_type: 'minimum_battery_reserve',
      structured_adjustment: {
        hours,
        minimum_energy_kwh: Math.round(minKwh * 100) / 100
      },
      explanation: `Battery reserve of ${minKwh} kWh enforced in hours ${hours.join(', ')}.`
    };
  }

  // 3. No Charge Window
  if (
    (text.includes('charger') ||
      text.includes('charging') ||
      text.includes('charging circuit')) &&
    (text.includes('isolated') ||
      text.includes('disabled') ||
      text.includes('unavailable') ||
      text.includes('outage') ||
      text.includes('maintenance')) &&
    hours.length > 0
  ) {
    return {
      note_index: noteIndex,
      applies: true,
      directive_type: 'no_charge_window',
      structured_adjustment: {
        hours
      },
      explanation: `Battery charging disabled in hours ${hours.join(', ')}.`
    };
  }

  // 4. No Discharge Window
  if (
    (text.includes('discharge') ||
      text.includes('discharging') ||
      text.includes('not discharge') ||
      text.includes('do not discharge')) &&
    hours.length > 0
  ) {
    return {
      note_index: noteIndex,
      applies: true,
      directive_type: 'no_discharge_window',
      structured_adjustment: {
        hours
      },
      explanation: `Battery discharging disabled in hours ${hours.join(', ')}.`
    };
  }

  // 5. Max Grid Window
  if (
    (text.includes('grid') ||
      text.includes('import') ||
      text.includes('feeder') ||
      text.includes('transformer') ||
      text.includes('substation') ||
      text.includes('intake')) &&
    hours.length > 0
  ) {
    let maxGrid = Infinity;
    const kwhMatch = text.match(/(\d+)\s*kwh/);
    if (kwhMatch) {
      maxGrid = parseFloat(kwhMatch[1]);
    }

    if (maxGrid !== Infinity) {
      return {
        note_index: noteIndex,
        applies: true,
        directive_type: 'max_grid_window',
        structured_adjustment: {
          hours,
          max_grid_kwh: maxGrid
        },
        explanation: `Grid import capped at ${maxGrid} kWh in hours ${hours.join(', ')}.`
      };
    }
  }

  return createNoOp(noteIndex);
}

function createNoOp(noteIndex: number) {
  return {
    note_index: noteIndex,
    applies: false,
    directive_type: 'no_op',
    structured_adjustment: null,
    explanation: 'This note does not affect today\'s 24-hour energy schedule.'
  };
}

function extractHoursFromText(text: string): number[] {
  const rangePattern =
    /(?:from|between|during)\s+(?:hour\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight|\d+)\s+(?:until|to|and)\s+(?:hour\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight|\d+)/i;
  const dashPattern =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight)/i;

  const match = text.match(rangePattern) || text.match(dashPattern);

  if (match) {
    const start = parseTimeString(match[1]);
    const end = parseTimeString(match[2]);

    if (start !== null && end !== null && end > start) {
      const hours: number[] = [];
      for (let h = start; h < end; h++) {
        hours.push(h);
      }
      return hours;
    }
  }

  return [];
}

function parseTimeString(str: string): number | null {
  const s = str.trim().toLowerCase().replace(/\s+/g, '');
  if (s === 'noon') return 12;
  if (s === 'midnight') return 0;

  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let val = parseInt(ampmMatch[1], 10);
    const mer = ampmMatch[3];
    if (mer === 'pm' && val < 12) val += 12;
    if (mer === 'am' && val === 12) val = 0;
    return val;
  }

  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const val = parseInt(hm[1], 10);
    if (val >= 0 && val <= 23) return val;
  }

  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 0 && num <= 24) {
    return num;
  }

  return null;
}
