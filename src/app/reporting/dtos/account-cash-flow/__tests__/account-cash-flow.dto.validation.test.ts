import { getAccountCashFlowQueryValidationSchema } from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.validation';

describe('getAccountCashFlowQueryValidationSchema', () => {
  const query = { from: '2024-02-29', to: '2024-03-01', bucketDays: 4 };
  it('accepts ISO calendar dates and a positive integer bucket size', () => {
    expect(
      getAccountCashFlowQueryValidationSchema.safeParse(query).success
    ).toBe(true);
  });
  it.each([
    { from: '2026-02-29' },
    { to: '2024-02-30' },
    { from: '2024-2-01' },
    { from: '2024-01-01T00:00:00Z' },
    { from: '0000-01-01' },
    { to: '0000-01-01' },
    { from: undefined },
    { to: null },
    { bucketDays: 0 },
    { bucketDays: -1 },
    { bucketDays: 1.5 },
    { bucketDays: '4' },
    { bucketDays: Infinity },
    { bucketDays: Number.MAX_SAFE_INTEGER + 1 },
    { bucketDays: undefined },
  ])('rejects invalid query fields %j', (override) => {
    const parsed = getAccountCashFlowQueryValidationSchema.safeParse({
      ...query,
      ...override,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(
        /^app_error_reporting_(from_date|to_date|bucket_days)_invalid$/
      );
    }
  });
});
