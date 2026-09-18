"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretOperatorNotes = interpretOperatorNotes;
exports.parseNotesDeterministic = parseNotesDeterministic;
async function interpretOperatorNotes(params) {
    const { operator_notes, battery, apiKey = process.env.MISTRAL_API_KEY, model = process.env.MISTRAL_MODEL || 'mistral-small-latest', timeoutMs = 8000 } = params;
    if (apiKey && apiKey.trim().length > 0) {
        try {
            const llmResult = await callMistralApi(operator_notes, battery, apiKey, model, timeoutMs);
            if (Array.isArray(llmResult) && llmResult.length === operator_notes.length) {
                return llmResult;
            }
        }
        catch (err) {
            console.warn(`Mistral API interpretation failed or timed out (${err.message}). Using deterministic fallback parser.`);
        }
    }
    // Fallback to deterministic NLP / rule-based parser
    return parseNotesDeterministic(operator_notes, battery);
}
async function callMistralApi(operatorNotes, battery, apiKey, model, timeoutMs) {
    const systemPrompt = `You are an energy grid assistant interpreting operator notes for a 24-hour campus energy schedule.
You must analyze each operator note and output a JSON object matching this schema:
{
  "interpretations": [
    {
      "note_index": number, // 0..N-1 matching input note order
      "applies": boolean, // false ONLY if directive_type is "no_op", true for all others
      "directive_type": "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op",
      "structured_adjustment": {
        "hours": number[], // unique 0..23 integers in ascending order (start-inclusive, end-exclusive)
        "factor": number, // for solar_reduction: USABLE FRACTION REMAINING (e.g. 80% reduction => factor: 0.2, 25% of forecast => factor: 0.25, half => factor: 0.5)
        "minimum_energy_kwh": number, // for minimum_battery_reserve in kWh (if percentage given, compute % of battery capacity ${battery.capacity_kwh} kWh)
        "max_grid_kwh": number // for max_grid_window in kWh per hour
      } | null,
      "explanation": "short human explanation"
    }
  ]
}

Strict Rules:
1. Directive types allowed:
   - "solar_reduction": Usable solar output is reduced. factor is fraction REMAINING (e.g., 80% reduction means 0.2 remaining).
   - "minimum_battery_reserve": Battery energy must stay >= level in listed hours. If % given, convert to kWh using total capacity = ${battery.capacity_kwh} kWh.
   - "no_charge_window": Battery charging is forbidden in listed hours.
   - "no_discharge_window": Battery discharging is forbidden in listed hours.
   - "max_grid_window": Grid import capped in listed hours.
   - "no_op": Distractor / irrelevant note that does not affect today's energy schedule. applies must be false, structured_adjustment must be null.
2. Time windows are start-inclusive and end-exclusive!
   - "noon until 2 PM" -> [12, 13]
   - "2 AM until 5 AM" -> [2, 3, 4]
   - "6 PM until 9 PM" -> [18, 19, 20]
   - "between 11 AM and 2 PM" -> [11, 12, 13]
3. Exactly ONE interpretation per note, in note_index order 0..${operatorNotes.length - 1}.
`;
    const userPrompt = `Operator Notes to interpret:
${operatorNotes.map((note, idx) => `[Note ${idx}]: "${note}"`).join('\n')}`;
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
        const parsed = JSON.parse(content);
        return parsed.interpretations || parsed.directive_interpretation || parsed;
    }
    finally {
        clearTimeout(timer);
    }
}
function parseNotesDeterministic(operatorNotes, battery) {
    return operatorNotes.map((note, idx) => parseSingleNoteDeterministic(note, idx, battery));
}
function parseSingleNoteDeterministic(note, noteIndex, battery) {
    const text = note.toLowerCase();
    // Helper for time extraction
    const hours = extractHoursFromText(text);
    // Check for Solar Reduction
    if (text.includes('solar') || text.includes('rooftop') || text.includes('cloud')) {
        let factor = 1.0;
        // Check percentage reduction vs remaining
        const reductionMatch = text.match(/(\d+)%\s*reduction/);
        const fractionMatch = text.match(/(\d+)%\s*of/);
        const percentMatch = text.match(/(\d+)%/);
        if (reductionMatch) {
            const redPercent = parseFloat(reductionMatch[1]);
            factor = Math.max(0, (100 - redPercent) / 100);
        }
        else if (fractionMatch) {
            const fracPercent = parseFloat(fractionMatch[1]);
            factor = Math.min(1, fracPercent / 100);
        }
        else if (text.includes('half')) {
            factor = 0.5;
        }
        else if (percentMatch) {
            const p = parseFloat(percentMatch[1]);
            if (text.includes('reduce') || text.includes('cut')) {
                factor = Math.max(0, (100 - p) / 100);
            }
            else {
                factor = p / 100;
            }
        }
        if (hours.length > 0) {
            return {
                note_index: noteIndex,
                applies: true,
                directive_type: 'solar_reduction',
                structured_adjustment: {
                    hours,
                    factor
                },
                explanation: `Solar availability is reduced in hours ${hours.join(', ')}.`
            };
        }
    }
    // Check for Minimum Battery Reserve
    if (text.includes('reserve') || text.includes('keep at least') || text.includes('remain in the battery') || text.includes('emergency operations') || text.includes('emergency services') || text.includes('backup')) {
        let minKwh = battery.minimum_energy_kwh;
        const percentMatch = text.match(/(\d+)%\s*of/);
        const kwhMatch = text.match(/(\d+)\s*kwh/);
        if (percentMatch) {
            const pct = parseFloat(percentMatch[1]);
            minKwh = (pct / 100) * battery.capacity_kwh;
        }
        else if (kwhMatch) {
            minKwh = parseFloat(kwhMatch[1]);
        }
        if (hours.length > 0) {
            return {
                note_index: noteIndex,
                applies: true,
                directive_type: 'minimum_battery_reserve',
                structured_adjustment: {
                    hours,
                    minimum_energy_kwh: minKwh
                },
                explanation: `Battery reserve required in hours ${hours.join(', ')}.`
            };
        }
    }
    // Check for No Charge Window
    if (text.includes('charger') || text.includes('charging') || text.includes('isolated') || text.includes('no_charge')) {
        if (text.includes('disabled') || text.includes('isolated') || text.includes('unavailable') || text.includes('maintenance') || text.includes('not charge')) {
            if (hours.length > 0) {
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
        }
    }
    // Check for No Discharge Window
    if (text.includes('discharge') || text.includes('discharging') || text.includes('relay testing') || text.includes('protection testing')) {
        if (text.includes('not discharge') || text.includes('disabled') || text.includes('testing') || text.includes('forbidden')) {
            if (hours.length > 0) {
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
        }
    }
    // Check for Max Grid Window
    if (text.includes('grid') || text.includes('import') || text.includes('feeder') || text.includes('transformer') || text.includes('substation') || text.includes('intake')) {
        let maxGrid = Infinity;
        const kwhMatch = text.match(/(\d+)\s*kwh/);
        if (kwhMatch) {
            maxGrid = parseFloat(kwhMatch[1]);
        }
        if (hours.length > 0 && maxGrid !== Infinity) {
            return {
                note_index: noteIndex,
                applies: true,
                directive_type: 'max_grid_window',
                structured_adjustment: {
                    hours,
                    max_grid_kwh: maxGrid
                },
                explanation: `Grid import capped in hours ${hours.join(', ')}.`
            };
        }
    }
    // Fallback to no_op for distractor notes
    return {
        note_index: noteIndex,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: 'This note does not affect today\'s energy schedule.'
    };
}
function extractHoursFromText(text) {
    // Regex for "from X until/to Y" or "between X and Y"
    const fromUntilMatch = text.match(/(?:from|between)\s+(?:hour\s+)?(\d+|noon|\d+\s*(?:am|pm))\s+(?:until|to|and)\s+(?:hour\s+)?(\d+|noon|\d+\s*(?:am|pm))/i);
    if (fromUntilMatch) {
        const startStr = fromUntilMatch[1];
        const endStr = fromUntilMatch[2];
        const start = parseTimeString(startStr);
        const end = parseTimeString(endStr);
        if (start !== null && end !== null && end > start) {
            const res = [];
            for (let h = start; h < end; h++) {
                res.push(h);
            }
            return res;
        }
    }
    return [];
}
function parseTimeString(str) {
    const s = str.trim().toLowerCase();
    if (s === 'noon')
        return 12;
    if (s === 'midnight')
        return 0;
    const ampmMatch = s.match(/^(\d+)\s*(am|pm)$/);
    if (ampmMatch) {
        let val = parseInt(ampmMatch[1], 10);
        const mer = ampmMatch[2];
        if (mer === 'pm' && val < 12)
            val += 12;
        if (mer === 'am' && val === 12)
            val = 0;
        return val;
    }
    const num = parseInt(s, 10);
    if (!isNaN(num) && num >= 0 && num <= 24) {
        return num;
    }
    return null;
}
//# sourceMappingURL=index.js.map