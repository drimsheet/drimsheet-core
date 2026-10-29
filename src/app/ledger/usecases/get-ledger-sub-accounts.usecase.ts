/**
 * SUMMARY
 * Retrieves subaccounts of an existing account in the selected entity and
 * enriches them with balances. Returns an array, which may be empty; rejects a
 * missing parent account.
 *
 * WHEN TO USE
 * Use to inspect the accounts under a selected parent. Use get-chart-of-
 * accounts for a structured tree.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountQueryRepo: ILedgerAccountQueryRepo;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
}

export default function makeGetLedgerSubAccountsUsecase(deps: IDependencies) {
  return async (accountId: TEntityId): Promise<ILedgerAccountDto[]> => {
    stringUtils.validateUUID(accountId, ledgerAccountError.InvalidId);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      accountId,
      accountingEntity.id,
      repoOptions
    );

    if (!account) {
      throw new ledgerAppError.AccountNotFound();
    }

    const subAccounts = await deps.ledgerAccountQueryRepo.findSubAccounts(
      accountId,
      accountingEntity.id,
      repoOptions
    );

    return deps.balanceEnrichmentAppService.enrich(
      subAccounts,
      accountingEntity,
      repoOptions
    );
  };
}
