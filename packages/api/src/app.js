"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const shared_types_1 = require("@gridwise/shared-types");
const llm_interpreter_1 = require("@gridwise/llm-interpreter");
const guardrails_1 = require("@gridwise/guardrails");
const optimizer_1 = require("@gridwise/optimizer");
const schedule_validator_1 = require("@gridwise/schedule-validator");
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: false,
        bodyLimit: 1048576 // 1MB
    });
    // Health Check
    app.get('/health', async (req, reply) => {
        return reply.status(200).send({ status: 'ok' });
    });
    // Energy Optimization Endpoint
    app.post('/optimize-energy', async (req, reply) => {
        try {
            // 1. Validate request body against Zod schema
            const parseResult = shared_types_1.OptimizeEnergyRequestSchema.safeParse(req.body);
            if (!parseResult.success) {
                return reply.status(400).send({
                    error: 'Bad Request',
                    message: 'Invalid request body schema.',
                    details: parseResult.error.issues.map((i) => i.message)
                });
            }
            const body = parseResult.data;
            // 2. LLM Interpretation Stage
            const rawInterpretations = await (0, llm_interpreter_1.interpretOperatorNotes)({
                operator_notes: body.operator_notes,
                battery: body.battery,
                timeoutMs: 15000
            });
            // 3. Guardrail Validation Stage
            const sanitizedDirectives = (0, guardrails_1.validateAndSanitizeDirectives)(rawInterpretations, body.operator_notes, body.battery);
            // 4. Math Optimizer Stage
            const optResult = (0, optimizer_1.optimizeSchedule)(body.hours, body.battery, sanitizedDirectives);
            // 5. Final Schedule Validator Stage
            const valResult = (0, schedule_validator_1.validateSchedule)(body.hours, body.battery, sanitizedDirectives, optResult.hourly_plan, optResult.total_grid_kwh, optResult.total_cost_bdt, optResult.peak_grid_kwh);
            if (!valResult.valid) {
                console.warn('Schedule validation warnings:', valResult.errors);
            }
            // 6. Generate Plan Summary
            const appliedCount = sanitizedDirectives.filter((d) => d.applies).length;
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
        }
        catch (err) {
            console.error('Unhandled API error:', err.message || err);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'An internal error occurred during optimization processing.'
            });
        }
    });
    return app;
}
//# sourceMappingURL=app.js.map