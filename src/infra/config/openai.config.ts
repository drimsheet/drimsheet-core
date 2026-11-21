import OpenAI from 'openai';

import vars from '@infra/config/vars.config';

let client: OpenAI | undefined;

export function getOpenAiClient(): OpenAI {
  client ??= new OpenAI({ apiKey: vars.OPEN_AI_KEY });
  return client;
}
