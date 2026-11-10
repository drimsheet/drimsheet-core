import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

interface IGetCounterpartiesPayload {
  ids: (string | null)[];
  accountingEntityId: TEntityId;
  repo: ICounterpartyRepo;
  repoOptions: IReadRepoOptions;
}

/**
 * Retrieves distinct non-null references and rejects incomplete results.
 * IDs are matched exactly as received. Returns the repository result unchanged
 * and propagates read failures without writes or event publication.
 */
export default async function getCounterpartiesHelper({
  ids,
  accountingEntityId,
  repo,
  repoOptions,
}: IGetCounterpartiesPayload): Promise<ICounterparty[]> {
  const counterpartyIds = [...new Set(ids.filter((id) => id !== null))];
  const counterparties = await repo.findByIds(
    counterpartyIds as TEntityId[],
    accountingEntityId,
    repoOptions
  );
  const foundIds = new Set<string>(
    counterparties.map((counterparty) => counterparty.id)
  );

  for (const id of counterpartyIds) {
    if (!foundIds.has(id)) {
      throw new counterpartyError.InvalidCounterpartyId({ id });
    }
  }

  return counterparties;
}
