import type z from 'zod';

/**
 * Shared tool metadata and execution contract.
 * Callers validate input with inputSchema before invoking func. Results remain
 * application data; errors propagate to the invoking delivery adapter.
 */
export interface IAgentTool<
  InputSchema extends z.ZodObject = z.ZodObject,
  Output extends object = object,
> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  outputSchema?: z.ZodObject;
  annotations?: { readOnlyHint: boolean };
  func(input: z.output<InputSchema>): Promise<Output> | Output;
}

export type TAiAssessmentValue<T> = T | '__undetermined__';

export interface IAiAssessment<T> {
  value: TAiAssessmentValue<T>;
  confidence: number;
  evidence: string[];
}
