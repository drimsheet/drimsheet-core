import type { CallToolResult } from '@modelcontextprotocol/server';

/** Normalize DTO dates to their JSON representation for both result formats. */
export default function toToolResultHelper(response: object): CallToolResult {
  const text = JSON.stringify(response);
  const structuredContent: Record<string, unknown> = JSON.parse(text);

  return { content: [{ type: 'text', text }], structuredContent };
}
