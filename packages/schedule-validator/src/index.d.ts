import { HourlyInput, BatterySpec, DirectiveInterpretation, HourlyPlanItem } from '@gridwise/shared-types';
export interface ScheduleValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateSchedule(hours: HourlyInput[], battery: BatterySpec, directives: DirectiveInterpretation[], hourlyPlan: HourlyPlanItem[], totalGridKwh: number, totalCostBdt: number, peakGridKwh: number, tolerance?: number): ScheduleValidationResult;
//# sourceMappingURL=index.d.ts.map