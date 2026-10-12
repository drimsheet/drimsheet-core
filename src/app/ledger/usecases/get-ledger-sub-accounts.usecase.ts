import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContext;
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
