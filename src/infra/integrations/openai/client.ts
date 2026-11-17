import OpenAI from 'openai';

import vars from '@infra/config/vars.config';

const openAiClient = new OpenAI({
  apiKey: vars.OPEN_AI_KEY,
});

export default openAiClient;
