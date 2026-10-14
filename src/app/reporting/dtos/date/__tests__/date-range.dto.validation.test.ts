import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';

describe('dateRangeValidationSchema', () => {
  it.each([
    { from: '2024-02-29', to: '2024-03-01' },
    { from: '0001-01-01', to: '9999-12-31' },
  ])('accepts calendar-date strings %j', (range) => {
    expect(dateRangeValidationSchema.parse(range)).toEqual(range);
  });

  it.each([
    ['from', '2026-02-29'],
    ['to', '2026-02-30'],
    ['from', '2026-2-01'],
    ['to', '2026-10-01T00:00:00Z'],
    ['from', '0000-01-01'],
    ['to', '0000-01-01'],
    ['from', undefined],
    ['to', null],
    ['from', new Date('2026-10-01')],
  ])('reports an invalid %s field for %p', (field, value) => {
    const parsed = dateRangeValidationSchema.safeParse({
      from: '2026-10-01',
      to: '2026-10-14',
      [field as string]: value,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: [field],
      message: `app_error_reporting_${field}_date_invalid`,
    });
  });

  it('leaves period ordering and length to reporting validation', () => {
    const range = { from: '2026-10-14', to: '2024-01-01' };
    expect(dateRangeValidationSchema.parse(range)).toEqual(range);
  });
});
