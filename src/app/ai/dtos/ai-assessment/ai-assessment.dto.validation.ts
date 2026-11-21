import z from 'zod';

const undeterminedValidation = z.literal('__undetermined__');

/** Validates an assessed value together with its confidence and evidence. */
export function aiAssessmentValidation<T extends z.ZodType>(
  valueValidation: T
) {
  return z.strictObject({
    value: valueValidation.or(undeterminedValidation),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  });
}
