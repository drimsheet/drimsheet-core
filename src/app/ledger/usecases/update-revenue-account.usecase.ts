import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import IRevenueAccountService from '@domain/ledger/types/revenue-account.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountBalanceEnrichmentService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { IUpdateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { updateRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  ledgerAccountRepo: ILedgerAccountRepo;
  revenueAccountService: IRevenueAccountService;
  balanceEnrichmentService: ILedgerAccountBalanceEnrichmentService;
}

export default function makeUpdateRevenueAccountUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IUpdateRevenueAccountDto
  ): Promise<ILedgerAccountDto> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(updateRevenueAccountValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const existingAccount = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!existingAccount) {
      throw new ledgerAppError.AccountNotFound({ id });
    }

    const [account, events, audit] = deps.revenueAccountService.update(
      existingAccount,
      {
        name: payload.name,
      }
    );

    if (audit) {
      // The repository atomically saves the account and history; stale writes conflict.
      await deps.ledgerAccountRepo.update(account, {
        ...repoOptions,
        expectedVersion: existingAccount.version,
        history: historyValue.make(audit, actor.id, correlationId),
      });
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );
    }

    const [response] = await deps.balanceEnrichmentService.enrich(
      [account],
      accountingEntity,
      repoOptions
    );
    return response;
  };
}
