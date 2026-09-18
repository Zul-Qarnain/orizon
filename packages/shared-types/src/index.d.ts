import { z } from 'zod';
export declare const DirectiveTypeEnum: z.ZodEnum<["solar_reduction", "minimum_battery_reserve", "no_charge_window", "no_discharge_window", "max_grid_window", "no_op"]>;
export type DirectiveType = z.infer<typeof DirectiveTypeEnum>;
export declare const BatteryActionEnum: z.ZodEnum<["charge", "discharge", "idle"]>;
export type BatteryAction = z.infer<typeof BatteryActionEnum>;
export declare const SolarReductionAdjustmentSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    factor: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    factor: number;
}, {
    hours: number[];
    factor: number;
}>;
export declare const MinimumBatteryReserveAdjustmentSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    minimum_energy_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    minimum_energy_kwh: number;
}, {
    hours: number[];
    minimum_energy_kwh: number;
}>;
export declare const WindowAdjustmentSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    hours: number[];
}, {
    hours: number[];
}>;
export declare const MaxGridWindowAdjustmentSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    max_grid_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    max_grid_kwh: number;
}, {
    hours: number[];
    max_grid_kwh: number;
}>;
export declare const StructuredAdjustmentSchema: z.ZodUnion<[z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    factor: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    factor: number;
}, {
    hours: number[];
    factor: number;
}>, z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    minimum_energy_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    minimum_energy_kwh: number;
}, {
    hours: number[];
    minimum_energy_kwh: number;
}>, z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    hours: number[];
}, {
    hours: number[];
}>, z.ZodObject<{
    hours: z.ZodArray<z.ZodNumber, "many">;
    max_grid_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hours: number[];
    max_grid_kwh: number;
}, {
    hours: number[];
    max_grid_kwh: number;
}>, z.ZodNull]>;
export type StructuredAdjustment = {
    hours: number[];
    factor: number;
} | {
    hours: number[];
    minimum_energy_kwh: number;
} | {
    hours: number[];
} | {
    hours: number[];
    max_grid_kwh: number;
} | null;
export declare const DirectiveInterpretationSchema: z.ZodObject<{
    note_index: z.ZodNumber;
    applies: z.ZodBoolean;
    directive_type: z.ZodEnum<["solar_reduction", "minimum_battery_reserve", "no_charge_window", "no_discharge_window", "max_grid_window", "no_op"]>;
    structured_adjustment: z.ZodNullable<z.ZodAny>;
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note_index: number;
    applies: boolean;
    directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
    explanation: string;
    structured_adjustment?: any;
}, {
    note_index: number;
    applies: boolean;
    directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
    explanation: string;
    structured_adjustment?: any;
}>;
export type DirectiveInterpretation = z.infer<typeof DirectiveInterpretationSchema>;
export declare const HourlyInputSchema: z.ZodObject<{
    hour: z.ZodNumber;
    demand_kwh: z.ZodNumber;
    solar_kwh: z.ZodNumber;
    tariff_bdt_per_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hour: number;
    demand_kwh: number;
    solar_kwh: number;
    tariff_bdt_per_kwh: number;
}, {
    hour: number;
    demand_kwh: number;
    solar_kwh: number;
    tariff_bdt_per_kwh: number;
}>;
export type HourlyInput = z.infer<typeof HourlyInputSchema>;
export declare const BatterySpecSchema: z.ZodObject<{
    capacity_kwh: z.ZodNumber;
    initial_energy_kwh: z.ZodNumber;
    minimum_energy_kwh: z.ZodNumber;
    max_charge_kwh_per_hour: z.ZodNumber;
    max_discharge_kwh_per_hour: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    minimum_energy_kwh: number;
    capacity_kwh: number;
    initial_energy_kwh: number;
    max_charge_kwh_per_hour: number;
    max_discharge_kwh_per_hour: number;
}, {
    minimum_energy_kwh: number;
    capacity_kwh: number;
    initial_energy_kwh: number;
    max_charge_kwh_per_hour: number;
    max_discharge_kwh_per_hour: number;
}>;
export type BatterySpec = z.infer<typeof BatterySpecSchema>;
export declare const OptimizeEnergyRequestSchema: z.ZodObject<{
    scenario_id: z.ZodString;
    operator_notes: z.ZodArray<z.ZodString, "many">;
    hours: z.ZodArray<z.ZodObject<{
        hour: z.ZodNumber;
        demand_kwh: z.ZodNumber;
        solar_kwh: z.ZodNumber;
        tariff_bdt_per_kwh: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        hour: number;
        demand_kwh: number;
        solar_kwh: number;
        tariff_bdt_per_kwh: number;
    }, {
        hour: number;
        demand_kwh: number;
        solar_kwh: number;
        tariff_bdt_per_kwh: number;
    }>, "many">;
    battery: z.ZodObject<{
        capacity_kwh: z.ZodNumber;
        initial_energy_kwh: z.ZodNumber;
        minimum_energy_kwh: z.ZodNumber;
        max_charge_kwh_per_hour: z.ZodNumber;
        max_discharge_kwh_per_hour: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        minimum_energy_kwh: number;
        capacity_kwh: number;
        initial_energy_kwh: number;
        max_charge_kwh_per_hour: number;
        max_discharge_kwh_per_hour: number;
    }, {
        minimum_energy_kwh: number;
        capacity_kwh: number;
        initial_energy_kwh: number;
        max_charge_kwh_per_hour: number;
        max_discharge_kwh_per_hour: number;
    }>;
}, "strip", z.ZodTypeAny, {
    hours: {
        hour: number;
        demand_kwh: number;
        solar_kwh: number;
        tariff_bdt_per_kwh: number;
    }[];
    scenario_id: string;
    operator_notes: string[];
    battery: {
        minimum_energy_kwh: number;
        capacity_kwh: number;
        initial_energy_kwh: number;
        max_charge_kwh_per_hour: number;
        max_discharge_kwh_per_hour: number;
    };
}, {
    hours: {
        hour: number;
        demand_kwh: number;
        solar_kwh: number;
        tariff_bdt_per_kwh: number;
    }[];
    scenario_id: string;
    operator_notes: string[];
    battery: {
        minimum_energy_kwh: number;
        capacity_kwh: number;
        initial_energy_kwh: number;
        max_charge_kwh_per_hour: number;
        max_discharge_kwh_per_hour: number;
    };
}>;
export type OptimizeEnergyRequest = z.infer<typeof OptimizeEnergyRequestSchema>;
export declare const HourlyPlanItemSchema: z.ZodObject<{
    hour: z.ZodNumber;
    grid_kwh: z.ZodNumber;
    solar_used_kwh: z.ZodNumber;
    battery_action: z.ZodEnum<["charge", "discharge", "idle"]>;
    battery_kwh: z.ZodNumber;
    battery_energy_after_kwh: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hour: number;
    grid_kwh: number;
    solar_used_kwh: number;
    battery_action: "charge" | "discharge" | "idle";
    battery_kwh: number;
    battery_energy_after_kwh: number;
}, {
    hour: number;
    grid_kwh: number;
    solar_used_kwh: number;
    battery_action: "charge" | "discharge" | "idle";
    battery_kwh: number;
    battery_energy_after_kwh: number;
}>;
export type HourlyPlanItem = z.infer<typeof HourlyPlanItemSchema>;
export declare const OptimizeEnergyResponseSchema: z.ZodObject<{
    scenario_id: z.ZodString;
    directive_interpretation: z.ZodArray<z.ZodObject<{
        note_index: z.ZodNumber;
        applies: z.ZodBoolean;
        directive_type: z.ZodEnum<["solar_reduction", "minimum_battery_reserve", "no_charge_window", "no_discharge_window", "max_grid_window", "no_op"]>;
        structured_adjustment: z.ZodNullable<z.ZodAny>;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        note_index: number;
        applies: boolean;
        directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
        explanation: string;
        structured_adjustment?: any;
    }, {
        note_index: number;
        applies: boolean;
        directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
        explanation: string;
        structured_adjustment?: any;
    }>, "many">;
    hourly_plan: z.ZodArray<z.ZodObject<{
        hour: z.ZodNumber;
        grid_kwh: z.ZodNumber;
        solar_used_kwh: z.ZodNumber;
        battery_action: z.ZodEnum<["charge", "discharge", "idle"]>;
        battery_kwh: z.ZodNumber;
        battery_energy_after_kwh: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        hour: number;
        grid_kwh: number;
        solar_used_kwh: number;
        battery_action: "charge" | "discharge" | "idle";
        battery_kwh: number;
        battery_energy_after_kwh: number;
    }, {
        hour: number;
        grid_kwh: number;
        solar_used_kwh: number;
        battery_action: "charge" | "discharge" | "idle";
        battery_kwh: number;
        battery_energy_after_kwh: number;
    }>, "many">;
    total_grid_kwh: z.ZodNumber;
    total_cost_bdt: z.ZodNumber;
    peak_grid_kwh: z.ZodNumber;
    plan_summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    scenario_id: string;
    directive_interpretation: {
        note_index: number;
        applies: boolean;
        directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
        explanation: string;
        structured_adjustment?: any;
    }[];
    hourly_plan: {
        hour: number;
        grid_kwh: number;
        solar_used_kwh: number;
        battery_action: "charge" | "discharge" | "idle";
        battery_kwh: number;
        battery_energy_after_kwh: number;
    }[];
    total_grid_kwh: number;
    total_cost_bdt: number;
    peak_grid_kwh: number;
    plan_summary: string;
}, {
    scenario_id: string;
    directive_interpretation: {
        note_index: number;
        applies: boolean;
        directive_type: "solar_reduction" | "minimum_battery_reserve" | "no_charge_window" | "no_discharge_window" | "max_grid_window" | "no_op";
        explanation: string;
        structured_adjustment?: any;
    }[];
    hourly_plan: {
        hour: number;
        grid_kwh: number;
        solar_used_kwh: number;
        battery_action: "charge" | "discharge" | "idle";
        battery_kwh: number;
        battery_energy_after_kwh: number;
    }[];
    total_grid_kwh: number;
    total_cost_bdt: number;
    peak_grid_kwh: number;
    plan_summary: string;
}>;
export type OptimizeEnergyResponse = z.infer<typeof OptimizeEnergyResponseSchema>;
//# sourceMappingURL=index.d.ts.map