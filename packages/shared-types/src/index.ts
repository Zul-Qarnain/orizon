import { z } from 'zod';

export const DirectiveTypeEnum = z.enum([
  'solar_reduction',
  'minimum_battery_reserve',
  'no_charge_window',
  'no_discharge_window',
  'max_grid_window',
  'no_op'
]);

export type DirectiveType = z.infer<typeof DirectiveTypeEnum>;

export const BatteryActionEnum = z.enum(['charge', 'discharge', 'idle']);
export type BatteryAction = z.infer<typeof BatteryActionEnum>;

export const SolarReductionAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  factor: z.number().min(0).max(1)
});

export const MinimumBatteryReserveAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  minimum_energy_kwh: z.number().min(0)
});

export const WindowAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23))
});

export const MaxGridWindowAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  max_grid_kwh: z.number().min(0)
});

export const StructuredAdjustmentSchema = z.union([
  SolarReductionAdjustmentSchema,
  MinimumBatteryReserveAdjustmentSchema,
  WindowAdjustmentSchema,
  MaxGridWindowAdjustmentSchema,
  z.null()
]);

export type StructuredAdjustment =
  | { hours: number[]; factor: number }
  | { hours: number[]; minimum_energy_kwh: number }
  | { hours: number[] }
  | { hours: number[]; max_grid_kwh: number }
  | null;

export const DirectiveInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  applies: z.boolean(),
  directive_type: DirectiveTypeEnum,
  structured_adjustment: z.any().nullable(),
  explanation: z.string()
});

export type DirectiveInterpretation = z.infer<typeof DirectiveInterpretationSchema>;

export const HourlyInputSchema = z.object({
  hour: z.number().int().min(0).max(23),
  demand_kwh: z.number().min(0),
  solar_kwh: z.number().min(0),
  tariff_bdt_per_kwh: z.number().min(0)
});

export type HourlyInput = z.infer<typeof HourlyInputSchema>;

export const BatterySpecSchema = z
  .object({
    capacity_kwh: z.number().positive(),
    initial_energy_kwh: z.number().min(0),
    minimum_energy_kwh: z.number().min(0),
    max_charge_kwh_per_hour: z.number().min(0),
    max_discharge_kwh_per_hour: z.number().min(0)
  })
  .refine((b) => b.minimum_energy_kwh <= b.capacity_kwh, {
    message: 'minimum_energy_kwh cannot exceed capacity_kwh'
  })
  .refine((b) => b.initial_energy_kwh <= b.capacity_kwh, {
    message: 'initial_energy_kwh cannot exceed capacity_kwh'
  });

export type BatterySpec = z.infer<typeof BatterySpecSchema>;

export const OptimizeEnergyRequestSchema = z.object({
  scenario_id: z.string().min(1),
  operator_notes: z.array(z.string().min(1)).min(1).max(3),
  hours: z
    .array(HourlyInputSchema)
    .length(24)
    .superRefine((hours, ctx) => {
      const seen = new Set<number>();
      for (const hour of hours) {
        if (seen.has(hour.hour)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate hour ${hour.hour} in hours array.`
          });
        }
        seen.add(hour.hour);
      }
    }),
  battery: BatterySpecSchema
});

export type OptimizeEnergyRequest = z.infer<typeof OptimizeEnergyRequestSchema>;

export const HourlyPlanItemSchema = z.object({
  hour: z.number().int().min(0).max(23),
  grid_kwh: z.number().min(0),
  solar_used_kwh: z.number().min(0),
  battery_action: BatteryActionEnum,
  battery_kwh: z.number().min(0),
  battery_energy_after_kwh: z.number().min(0)
});

export type HourlyPlanItem = z.infer<typeof HourlyPlanItemSchema>;

export const OptimizeEnergyResponseSchema = z.object({
  scenario_id: z.string(),
  directive_interpretation: z.array(DirectiveInterpretationSchema),
  hourly_plan: z.array(HourlyPlanItemSchema).length(24),
  total_grid_kwh: z.number(),
  total_cost_bdt: z.number(),
  peak_grid_kwh: z.number(),
  plan_summary: z.string()
});

export type OptimizeEnergyResponse = z.infer<typeof OptimizeEnergyResponseSchema>;
