import z from 'zod';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';

const invalidVersionKey = new counterpartyError.InvalidVersion().errorKey;

export const counterpartyDeletionReqValidation = z.strictObject({
  expectedVersion: z
    .number(invalidVersionKey)
    .int(invalidVersionKey)
    .positive(invalidVersionKey),
});
