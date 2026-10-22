import { ECalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';
import periodError from '@shared/values/interval/period.error';
import periodValue from '@shared/values/interval/period.vo';
import periodValidation from '@shared/values/interval/validations/period.validation';

function makeCreationInput() {
  return {
    id: '11111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: '22222222-2222-4222-8222-222222222222' as TEntityId,
    unit: ECalendarUnits.Month,
    count: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
  };
}

function makePeriod() {
  return periodValue.make(makeCreationInput(), [{ name: 'January' }])[0];
}

describe('periodValidation', () => {
  it('exposes frozen validations and accepts a constructed period', () => {
    expect(Object.isFrozen(periodValidation)).toBe(true);
    expect(() => periodValidation.validate(makePeriod())).not.toThrow();
  });

  it('accepts valid period creation inputs', () => {
    expect(() =>
      periodValidation.validateCreation(makeCreationInput(), [
        { name: 'January' },
      ])
    ).not.toThrow();
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 2])(
    'rejects invalid creation count %s',
    (count) => {
      expect(() =>
        periodValidation.validateCreation({ ...makeCreationInput(), count }, [
          { name: 'January' },
        ])
      ).toThrow(periodError.InvalidCount);
    }
  );

  it.each([
    [{ id: 'bad' as TEntityId }, periodError.InvalidIntervalId],
    [
      { accountingEntityId: 'bad' as TEntityId },
      periodError.InvalidAccountingEntityId,
    ],
    [
      { unit: 'bad' as ReturnType<typeof makeCreationInput>['unit'] },
      periodError.InvalidUnit,
    ],
    [{ startDate: new Date(NaN) }, periodError.InvalidDateRange],
    [{ endDate: new Date('2024-01-01') }, periodError.InvalidDateRange],
  ] as const)('rejects invalid creation fields: %s', (changes, error) => {
    expect(() =>
      periodValidation.validateCreation(
        { ...makeCreationInput(), ...changes },
        [{ name: 'January' }]
      )
    ).toThrow(error);
  });

  it.each([
    { payload: [] },
    { payload: [{ name: 'First' }, { name: 'Extra' }] },
    { payload: new Array<{ name: string }>(1) },
    { payload: [null] as unknown as { name: string }[] },
    { payload: null as unknown as { name: string }[] },
  ])('rejects incomplete creation inputs: %s', ({ payload }) => {
    expect(() =>
      periodValidation.validateCreation(makeCreationInput(), payload)
    ).toThrow(periodError.InvalidPeriods);
  });

  it('rejects an invalid period ID', () => {
    expect(() =>
      periodValidation.validate({ ...makePeriod(), id: 'bad' as TEntityId })
    ).toThrow(periodError.InvalidId);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid ordinal %s',
    (ordinal) => {
      expect(() =>
        periodValidation.validate({ ...makePeriod(), ordinal })
      ).toThrow(periodError.InvalidOrdinal);
    }
  );

  it.each([
    [new Date(NaN), new Date('2024-01-31')],
    [new Date('2024-01-01'), new Date(NaN)],
    [undefined as unknown as Date, new Date('2024-01-31')],
    [new Date('2024-01-01'), null as unknown as Date],
    [new Date('2024-02-01'), new Date('2024-01-31')],
    [new Date('2024-01-01'), new Date('2024-01-01')],
    [new Date('2024-01-01T12:00:01Z'), new Date('2024-01-01T12:00:00Z')],
  ])('rejects invalid dates: %s to %s', (startDate, endDate) => {
    expect(() =>
      periodValidation.validate({ ...makePeriod(), startDate, endDate })
    ).toThrow(periodError.InvalidDateRange);
  });
});
