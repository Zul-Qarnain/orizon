import { HourlyInput, BatterySpec, DirectiveInterpretation, HourlyPlanItem } from '@gridwise/shared-types';
export interface OptimizationResult {
    hourly_plan: HourlyPlanItem[];
    total_grid_kwh: number;
    total_cost_bdt: number;
    peak_grid_kwh: number;
}
export declare function optimizeSchedule(hours: HourlyInput[], battery: BatterySpec, directives: DirectiveInterpretation[]): OptimizationResult;
//# sourceMappingURL=index.d.ts.map