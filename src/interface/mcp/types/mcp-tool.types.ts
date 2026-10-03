import type {
  CallToolResult,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import type z from 'zod';

/** A tool's delivery contract; handlers receive schema-validated arguments. */
export default interface IMcpTool<
  InputSchema extends z.ZodObject = z.ZodObject,
  OutputSchema extends z.ZodObject = z.ZodObject,
> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  outputSchema?: OutputSchema;
  annotations?: ToolAnnotations;
  func(input: z.output<InputSchema>): Promise<CallToolResult> | CallToolResult;
}
