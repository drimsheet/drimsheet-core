import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import ILedgerAccountBalanceService from '@domain/ledger/types/ledger-account-balance.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { IPettyCashAccountUpdateReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { pettyCashUpdateReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountBalanceService: ILedgerAccountBalanceService;
  cashAccountService: ICashAccountService;
  openingBalanceEntryAppService: IOpeningBalanceEntryAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
}

export default function makeUpdatePettyCashAccountUseCase(
  deps: Readonly<IDependencies>
) {
  return async (
    id: string,
    payload: IPettyCashAccountUpdateReq
  ): Promise<ILedgerAccountDto> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(pettyCashUpdateReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);
    const repoOptions = { correlationId };

    const currency = payload.currencyCode
      ? currencyEntity.getByCode(payload.currencyCode)
      : undefined;

    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };

      const [account, accountEvents, accountAudit] =
        await deps.cashAccountService.updatePettyCashSubAccount(
          {
            id: id as TEntityId,
            accountingEntityId: accountingEntity.id,
            currency,
            name: payload.name,
            openingBalanceDate: payload.openingBalance?.date,
          },
          transactionOptions
        );

      const existingAccount = accountAudit?.diff.before ?? account;

      // Opening-journal eligibility needs the original opening date and the requested currency.
      const openingBalanceEntryMutation = payload.openingBalance
        ? await deps.openingBalanceEntryAppService.createOrRevise(
            {
              account: { ...existingAccount, currency: account.currency },
              openingBalance: payload.openingBalance,
              accountingEntity,
              actor: actor.id,
            },
            transactionOptions
          )
        : null;

      const accountAudits = accountAudit ? [accountAudit] : [];
      for (const currentAccountAudit of accountAudits) {
        // The account lock protects this read and write until the transaction commits.
        const existingBalance =
          await deps.ledgerAccountBalanceRepo.findByAccountId(
            account.id,
            accountingEntity.id,
            transactionOptions
          );
        if (!existingBalance) {
          throw new ledgerAppError.BalanceNotFound();
        }

        const balance = deps.ledgerAccountBalanceService.updateBalance({
          existingAccount,
          updatedAccount: account,
          existingBalance,
        });
        if (balance !== existingBalance) {
          await deps.ledgerAccountBalanceRepo.update(balance, {
            ...transactionOptions,
            expectedVersion: existingBalance.version,
          });
        }

        await deps.ledgerAccountRepo.update(account, {
          ...transactionOptions,
          expectedVersion: existingAccount.version,
          history: historyValue.make(
            currentAccountAudit,
            actor.id,
            correlationId
          ),
        });
      }

      const journalMutations = openingBalanceEntryMutation
        ? [openingBalanceEntryMutation.mutation]
        : [];
      for (const journalMutation of journalMutations) {
        const journalPersistencePayload =
          getJournalEntryPersistencePayloadHelper(
            journalMutation,
            actor.id,
            correlationId
          );
        await deps.journalEntryPersistenceAppService.rectify(
          journalPersistencePayload,
          transactionOptions
        );
      }

      const fxAcquisitions = openingBalanceEntryMutation?.fxAcquisition
        ? [openingBalanceEntryMutation.fxAcquisition]
        : [];
      for (const fxAcquisition of fxAcquisitions) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition.records,
          transactionOptions
        );
      }

      const entriesForBalancePropagation =
        openingBalanceEntryMutation?.entriesForBalancePropagation ?? [];
      for (const journalEntry of entriesForBalancePropagation) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntry.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events: IEvent<unknown>[] = [
        ...accountEvents,
        ...(openingBalanceEntryMutation?.mutation.events ?? []),
        ...(openingBalanceEntryMutation?.fxAcquisition?.events ?? []),
      ];
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );

      for (const journalEntry of entriesForBalancePropagation) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: journalEntry.id,
        });
      }

      if (openingBalanceEntryMutation) {
        return ledgerAccountToDtoMapperHelper(
          account,
          openingBalanceEntryMutation.currentJournalEntry,
          accountingEntity.functionalCurrencyCode
        );
      }

      const [response] = await deps.balanceEnrichmentAppService.enrich(
        [account],
        accountingEntity,
        repoOptions
      );
      return response;
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
