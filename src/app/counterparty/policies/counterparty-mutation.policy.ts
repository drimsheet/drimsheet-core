import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

interface IValidateCounterpartyMutationPayload {
  id: string;
  counterparty: ICounterparty | null;
  accountingEntityId: TEntityId;
}

/** Rejects missing or foreign resources before mutation preparation. */
// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validate(
  payload: IValidateCounterpartyMutationPayload
): ICounterparty {
  const { id, counterparty, accountingEntityId } = payload;
  if (counterparty?.accountingEntityId !== accountingEntityId) {
    throw new appError.ResourceNotFound({ id });
  }
  return counterparty;
}

export default Object.freeze({ validate });
