/**
 * SUMMARY
 * Retrieves one account in the selected entity with its balance and functional
 * balance. Rejects a missing account.
 *
 * WHEN TO USE
 * Use to inspect an existing ledger account and its current derived balances.
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
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
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

    const [dto] = await deps.balanceEnrichmentAppService.enrich(
      [account],
      accountingEntity,
      repoOptions
    );

    return dto;
  };
}
