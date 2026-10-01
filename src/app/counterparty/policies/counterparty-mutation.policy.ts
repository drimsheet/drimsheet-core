import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

interface IValidateCounterpartyMutationPayload {
  id: string;
  counterparty: ICounterparty | null;
  accountingEntityId: TEntityId;
  expectedVersion: number;
}

/** Rejects missing/foreign resources and stale client versions before preparation. */
function validate(
  payload: IValidateCounterpartyMutationPayload
): ICounterparty {
  const { id, counterparty, accountingEntityId, expectedVersion } = payload;
  if (counterparty?.accountingEntityId !== accountingEntityId) {
    throw new appError.ResourceNotFound({ id });
  }
  if (counterparty.version !== expectedVersion) {
    throw new appError.Conflict({
      expectedVersion,
      actualVersion: counterparty.version,
    });
  }
  return counterparty;
}

export default Object.freeze({ validate });
