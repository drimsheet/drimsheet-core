import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountBalanceEnrichmentService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  balanceEnrichmentService: ILedgerAccountBalanceEnrichmentService;
}

export default function makeGetLedgerAccountUseCase(deps: IDependencies) {
  return async (accountId: TEntityId): Promise<ILedgerAccountDto> => {
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

    const [dto] = await deps.balanceEnrichmentService.enrich(
      [account],
      accountingEntity,
      repoOptions
    );

    return dto;
  };
}
