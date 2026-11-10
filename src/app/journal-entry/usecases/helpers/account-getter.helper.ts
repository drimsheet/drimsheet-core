import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IGetLedgerAccountPayload {
  id: string;
  accountingEntityId: string;
  repo: ILedgerAccountRepo;
  repoOptions: IReadRepoOptions;
}

export default async function getLedgerAccountHelper({
  id,
  accountingEntityId,
  repo,
  repoOptions,
}: IGetLedgerAccountPayload) {
  const account = await repo.findById(
    id as TEntityId,
    accountingEntityId as TEntityId,
    repoOptions
  );

  if (!account) {
    throw new ledgerAppError.AccountNotFound({
      id,
    });
  }

  return account;
}
