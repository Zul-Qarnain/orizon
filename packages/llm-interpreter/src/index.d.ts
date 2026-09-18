import { BatterySpec } from '@gridwise/shared-types';
export interface InterpretNotesParams {
    operator_notes: string[];
    battery: BatterySpec;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
}
export declare function interpretOperatorNotes(params: InterpretNotesParams): Promise<any[]>;
export declare function parseNotesDeterministic(operatorNotes: string[], battery: BatterySpec): any[];
//# sourceMappingURL=index.d.ts.map