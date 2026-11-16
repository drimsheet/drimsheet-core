import z from 'zod';

import aiAppError from '@app/ai/errors/ai.error';

const invalidConfidenceKey = new aiAppError.InvalidConfidence().errorKey;
const invalidEvidenceKey = new aiAppError.InvalidEvidence().errorKey;

export function aiAssessmentValueValidation<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.literal('__undetermined__')]);
}

export function aiAssessmentDtoValidation<T extends z.ZodType>(schema: T) {
  return z.object({
    value: aiAssessmentValueValidation(schema),
    confidence: z
      .number(invalidConfidenceKey)
      .min(0, invalidConfidenceKey)
      .max(1, invalidConfidenceKey),
    evidence: z.array(z.string(invalidEvidenceKey), invalidEvidenceKey),
  });
}
