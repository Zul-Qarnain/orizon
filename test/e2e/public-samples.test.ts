import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildApp } from '../../packages/api/src/app.js';
import { validateSchedule } from '../../packages/schedule-validator/src/index.js';

describe('GridWise Public Sample Cases Pack (E2E)', () => {
  let app: any;
  let samplePack: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const sampleFilePath = path.resolve(process.cwd(), 'problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json');
    const content = fs.readFileSync(sampleFilePath, 'utf-8');
    samplePack = JSON.parse(content);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should pass GET /health', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('should run and validate all 10 public sample cases', async () => {
    const cases = samplePack.cases;
    expect(cases.length).toBe(10);

    for (const c of cases) {
      const response = await app.inject({
        method: 'POST',
        url: '/optimize-energy',
        payload: c.input
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // 1. Check response metadata
      expect(body.scenario_id).toBe(c.input.scenario_id);
      expect(body.directive_interpretation).toBeDefined();
      expect(body.hourly_plan).toHaveLength(24);

      // 2. Directive Interpretation assertions
      const expectedDirs = c.expected_output.directive_interpretation;
      expect(body.directive_interpretation).toHaveLength(expectedDirs.length);

      for (let i = 0; i < expectedDirs.length; i++) {
        const actual = body.directive_interpretation[i];
        const expected = expectedDirs[i];

        expect(actual.note_index).toBe(expected.note_index);
        expect(actual.applies).toBe(expected.applies);
        expect(actual.directive_type).toBe(expected.directive_type);

        if (expected.structured_adjustment) {
          expect(actual.structured_adjustment).toBeDefined();
          expect(actual.structured_adjustment.hours).toEqual(expected.structured_adjustment.hours);

          if (expected.structured_adjustment.factor !== undefined) {
            expect(actual.structured_adjustment.factor).toBeCloseTo(expected.structured_adjustment.factor, 2);
          }
          if (expected.structured_adjustment.minimum_energy_kwh !== undefined) {
            expect(actual.structured_adjustment.minimum_energy_kwh).toBeCloseTo(expected.structured_adjustment.minimum_energy_kwh, 2);
          }
          if (expected.structured_adjustment.max_grid_kwh !== undefined) {
            expect(actual.structured_adjustment.max_grid_kwh).toBeCloseTo(expected.structured_adjustment.max_grid_kwh, 2);
          }
        } else {
          expect(actual.structured_adjustment).toBeNull();
        }
      }

      // 3. Replay and validate schedule against all physical and directive constraints
      const validation = validateSchedule(
        c.input.hours,
        c.input.battery,
        body.directive_interpretation,
        body.hourly_plan,
        body.total_grid_kwh,
        body.total_cost_bdt,
        body.peak_grid_kwh
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // 4. Cost optimality verification (within 1% or 10 BDT of reference cost)
      expect(body.total_cost_bdt).toBeLessThanOrEqual(c.expected_output.total_cost_bdt + 10);
    }
  });

  it('should return 400 for malformed input body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/optimize-energy',
      payload: {
        scenario_id: 'INVALID',
        operator_notes: []
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Bad Request');
  });
});
