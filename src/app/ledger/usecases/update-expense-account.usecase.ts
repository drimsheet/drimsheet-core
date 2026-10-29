/**
 * SUMMARY
 * Updates the name of an eligible expense account in the selected entity. Saves
 * a changed name with audit history and publishes events; an unchanged name
 * produces no writes, audit, or events. Returns the account enriched with
 * balances and rejects missing or ineligible accounts.
 *
 * WHEN TO USE
 * Use to rename a expense account while retaining its identity, classification,
 * and financial history.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import IExpenseAccountService from '@domain/ledger/types/expense-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import { IUpdateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { updateExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  ledgerAccountRepo: ILedgerAccountRepo;
  expenseAccountService: IExpenseAccountService;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
}

export default function makeUpdateExpenseAccountUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IUpdateExpenseAccountDto
  ): Promise<ILedgerAccountDto> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(updateExpenseAccountValidation, payload);

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

    const [account, events, audit] = deps.expenseAccountService.update(
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

    const [response] = await deps.balanceEnrichmentAppService.enrich(
      [account],
      accountingEntity,
      repoOptions
    );
    return response;
  };
}
