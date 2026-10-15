import { getAccountCounterpartyParticipationQueryValidationSchema as schema } from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto.validation';

describe('getAccountCounterpartyParticipationQueryValidationSchema', () => {
  it.each([{}, { page: 1, limit: 200, search: 'Alice' }, { search: '' }])(
    'accepts %j',
    (query) => {
      expect(schema.safeParse(query).success).toBe(true);
    }
  );

  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { limit: '10' },
    { search: 1 },
  ])('rejects %j', (query) => {
    expect(schema.safeParse(query).success).toBe(false);
  });
});
