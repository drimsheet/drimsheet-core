import z from 'zod';

import { aiAssessmentValidation } from '@shared/values/ai-assessment/dto/ai-assessment.dto.validation';

describe('aiAssessmentValidation', () => {
  const validation = aiAssessmentValidation(z.object({ name: z.string() }));
  const assessment = {
    value: { name: 'Example Ltd' },
    confidence: 0.9,
    evidence: ['Invoice header', 'Page 1'],
  };

  it('accepts a value that matches the supplied schema', () => {
    expect(validation.parse(assessment)).toEqual(assessment);
  });

  it.each([0, 1])('accepts confidence at the boundary %p', (confidence) => {
    const assessmentAtBoundary = { ...assessment, confidence };

    expect(validation.parse(assessmentAtBoundary)).toEqual(
      assessmentAtBoundary
    );
  });

  it('accepts an undetermined value with zero confidence and empty evidence', () => {
    const undeterminedAssessment = {
      value: '__undetermined__',
      confidence: 0,
      evidence: [],
    };

    expect(validation.parse(undeterminedAssessment)).toEqual(
      undeterminedAssessment
    );
  });

  it('rejects a value that fails the supplied schema', () => {
    const parsed = validation.safeParse({ ...assessment, value: { name: 42 } });

    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ['value'] }),
    ]);
  });

  it.each([undefined, null, 'high', NaN, Infinity, -Infinity])(
    'rejects invalid confidence %p',
    (confidence) => {
      const parsed = validation.safeParse({ ...assessment, confidence });

      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: ['confidence'] }),
      ]);
    }
  );

  it.each([-0.01, 1.01])(
    'rejects confidence outside [0, 1]: %p',
    (confidence) => {
      const parsed = validation.safeParse({ ...assessment, confidence });

      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: ['confidence'] }),
      ]);
    }
  );

  it.each([
    { evidence: undefined, path: ['evidence'] },
    { evidence: null, path: ['evidence'] },
    { evidence: 'Page 1', path: ['evidence'] },
    { evidence: ['Page 1', 42], path: ['evidence', 1] },
  ])('rejects invalid evidence $evidence', ({ evidence, path }) => {
    const parsed = validation.safeParse({ ...assessment, evidence });

    expect(parsed.error?.issues).toEqual([expect.objectContaining({ path })]);
  });
});
