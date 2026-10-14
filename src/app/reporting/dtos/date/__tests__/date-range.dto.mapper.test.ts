import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';

describe('dateRangeMapper', () => {
  it.each([
    { from: '2024-02-29', to: '2024-03-01' },
    { from: '0001-01-01', to: '9999-12-31' },
  ])(
    'round-trips validated dates %j through UTC midnight boundaries',
    (dto) => {
      const range = dateRangeMapper.fromDto(dto);
      expect(range.from.toISOString()).toBe(`${dto.from}T00:00:00.000Z`);
      expect(range.to.toISOString()).toBe(`${dto.to}T00:00:00.000Z`);
      expect(dateRangeMapper.toDto(range)).toEqual(dto);
    }
  );

  it('formats UTC calendar dates independently of the original offsets', () => {
    const range = {
      from: new Date('2026-09-30T17:00:00-07:00'),
      to: new Date('2026-10-14T09:00:00+09:00'),
    };
    const originalFrom = range.from.getTime();
    const originalTo = range.to.getTime();
    expect(dateRangeMapper.toDto(range)).toEqual({
      from: '2026-10-01',
      to: '2026-10-14',
    });
    expect(range.from.getTime()).toBe(originalFrom);
    expect(range.to.getTime()).toBe(originalTo);
  });
});
