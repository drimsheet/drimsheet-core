import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

/**
 * Loads charge accounts in line order for the selected accounting entity.
 * Rejects when an account is missing; performs repository reads only.
 */
export default async function getTransferChargeAccountsHelper(
  chargeLines: IJournalLineReq[],
  accountingEntity: IAccountingEntity,
  repo: ILedgerAccountRepo,
  repoOptions: IReadRepoOptions
) {
  const chargeAccounts: ILedgerAccount[] = [];

  for (const chargeLine of chargeLines) {
    const chargeAccount = await repo.findById(
      chargeLine.accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!chargeAccount) {
      throw new ledgerAppError.AccountNotFound({
        id: chargeLine.accountId,
      });
    }

    chargeAccounts.push(chargeAccount);
  }

  return chargeAccounts;
}
