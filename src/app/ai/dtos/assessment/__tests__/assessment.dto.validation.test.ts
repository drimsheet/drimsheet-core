import z from 'zod';

import {
  aiAssessmentDtoValidation,
  aiAssessmentValueValidation,
} from '@app/ai/dtos/assessment/assessment.dto.validation';

describe('AI assessment DTO validation', () => {
  const validation = aiAssessmentDtoValidation(z.object({ name: z.string() }));
  const assessment = {
    value: { name: 'Acme' },
    confidence: 0.8,
    evidence: ['ACME'],
  };

  it('preserves the value and its record-level assessment', () => {
    expect(validation.parse(assessment)).toEqual(assessment);
  });

  it.each([0, 0.5, 1])('accepts confidence %s', (confidence) => {
    const payload = { ...assessment, confidence };
    expect(validation.parse(payload)).toEqual(payload);
  });

  it.each([-0.1, 1.1, NaN, Infinity, '0.8', undefined])(
    'rejects invalid confidence %s',
    (confidence) => {
      const result = validation.safeParse({ ...assessment, confidence });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['confidence'],
          message: 'app_error_ai_confidence_invalid',
        }),
      ]);
    }
  );

  it('accepts an entirely undetermined value with no evidence', () => {
    const payload = {
      value: '__undetermined__',
      confidence: 0,
      evidence: [],
    };
    expect(validation.parse(payload)).toEqual(payload);
  });

  it.each([undefined, null, 'ACME', [123]])(
    'rejects malformed evidence %j',
    (evidence) => {
      const result = validation.safeParse({ ...assessment, evidence });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ message: 'app_error_ai_evidence_invalid' }),
      ]);
    }
  );

  it.each([undefined, null, {}, { name: 123 }, '__unknown__'])(
    'rejects a value outside the supplied schema %j',
    (value) => {
      expect(validation.safeParse({ ...assessment, value }).success).toBe(
        false
      );
    }
  );

  it('supports unresolved nullable field values without treating null as unknown', () => {
    const nullableValidation = aiAssessmentValueValidation(
      z.string().nullable()
    );
    for (const value of ['counterparty_1', null, '__undetermined__']) {
      expect(nullableValidation.parse(value)).toBe(value);
    }
  });
});
