import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OptimizeEnergyRequestSchema } from '@gridwise/shared-types';
import { interpretOperatorNotes } from '@gridwise/llm-interpreter';
import { validateAndSanitizeDirectives } from '@gridwise/guardrails';
import { optimizeSchedule } from '@gridwise/optimizer';
import { validateSchedule } from '@gridwise/schedule-validator';

const SAMPLE_PACK_REL = 'problem_doc/BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json';
let cachedSamplePack: string | null = null;

function resolveSamplePackPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), SAMPLE_PACK_REL),
    path.resolve(process.cwd(), '../../', SAMPLE_PACK_REL),
    path.resolve(here, '../../../', SAMPLE_PACK_REL),
    path.resolve(here, '../../../../', SAMPLE_PACK_REL)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false,
    bodyLimit: 1048576 // 1MB
  });

  // Interactive Test Dashboard UI
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { TEST_UI_HTML } = await import('./ui.js');
    return reply.type('text/html').status(200).send(TEST_UI_HTML);
  });

  // Sample pack JSON route for UI
  app.get('/sample-pack.json', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cachedSamplePack) {
        const samplePath = resolveSamplePackPath();
        if (!samplePath) {
          return reply.status(404).send({ error: 'Sample pack file not found.' });
        }
        cachedSamplePack = fs.readFileSync(samplePath, 'utf-8');
      }
      return reply.type('application/json').send(cachedSamplePack);
    } catch {
      return reply.status(404).send({ error: 'Sample pack file not found.' });
    }
  });

  // Health Check
  app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Energy Optimization Endpoint
  app.post('/optimize-energy', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Validate request body against Zod schema
      const parseResult = OptimizeEnergyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid request body schema.',
          details: parseResult.error.issues.map((i: any) => i.message)
        });
      }

      const body = parseResult.data;

      // 2. LLM Interpretation Stage
      const rawInterpretations = await interpretOperatorNotes({
        operator_notes: body.operator_notes,
        battery: body.battery,
        timeoutMs: 3500
      });

      // 3. Guardrail Validation Stage
      const sanitizedDirectives = validateAndSanitizeDirectives(
        rawInterpretations,
        body.operator_notes,
        body.battery
      );

      // 4. Math Optimizer Stage
      const optResult = optimizeSchedule(body.hours, body.battery, sanitizedDirectives);

      // 5. Final Schedule Validator Stage
      const valResult = validateSchedule(
        body.hours,
        body.battery,
        sanitizedDirectives,
        optResult.hourly_plan,
        optResult.total_grid_kwh,
        optResult.total_cost_bdt,
        optResult.peak_grid_kwh
      );

      if (!valResult.valid) {
        console.warn('Schedule validation failed:', valResult.errors);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An internal error occurred during optimization processing.'
        });
      }

      // 6. Generate Plan Summary
      const appliedCount = sanitizedDirectives.filter((d: any) => d.applies).length;
      const plan_summary = `Optimized 24-hour campus energy plan applying ${appliedCount} operator directive(s). Total grid electricity: ${optResult.total_grid_kwh} kWh, Total cost: ${optResult.total_cost_bdt} BDT, Peak grid demand: ${optResult.peak_grid_kwh} kWh.`;

      // 7. Return API Response
      return reply.status(200).send({
        scenario_id: body.scenario_id,
        directive_interpretation: sanitizedDirectives,
        hourly_plan: optResult.hourly_plan,
        total_grid_kwh: optResult.total_grid_kwh,
        total_cost_bdt: optResult.total_cost_bdt,
        peak_grid_kwh: optResult.peak_grid_kwh,
        plan_summary
      });
    } catch (err: any) {
      console.error('Unhandled API error:', err.message || err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An internal error occurred during optimization processing.'
      });
    }
  });

  return app;
}
