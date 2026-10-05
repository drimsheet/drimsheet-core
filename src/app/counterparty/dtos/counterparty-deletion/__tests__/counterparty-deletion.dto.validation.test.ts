import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import { counterpartyDeletionReqValidation } from '@app/counterparty/dtos/counterparty-deletion/counterparty-deletion.dto.validation';

describe('counterparty deletion DTO validation', () => {
  it.each([1, 2, 100])('accepts expectedVersion %p', (expectedVersion) => {
    expect(
      counterpartyDeletionReqValidation.parse({ expectedVersion })
    ).toEqual({
      expectedVersion,
    });
  });

  it.each([undefined, null, 0, -1, 1.5, '1', true, NaN, Infinity])(
    'rejects invalid expectedVersion %p with the counterparty version key',
    (expectedVersion) => {
      const result = counterpartyDeletionReqValidation.safeParse({
        expectedVersion,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        path: ['expectedVersion'],
        message: new counterpartyError.InvalidVersion().errorKey,
      });
    }
  );

  it.each([
    undefined,
    null,
    [],
    'delete',
    {},
    { expectedVersion: 1, confirmed: true },
    { expectedVersion: 1, status: 'archived' },
    { expectedVersion: 1, actorId: 'forged' },
    { expectedVersion: 1, accountingEntityId: 'forged' },
  ])('rejects malformed or extra-field body %p', (payload) => {
    expect(counterpartyDeletionReqValidation.safeParse(payload).success).toBe(
      false
    );
  });
});
