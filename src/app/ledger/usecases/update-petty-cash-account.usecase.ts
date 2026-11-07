/**
 * SUMMARY
 * Updates a petty-cash account's name, currency, or opening balance in the
 * selected entity. Currency changes and opening-journal changes undergo their
 * own eligibility checks. Creates or revises an eligible opening journal when
 * requested. Saves account, balance-denomination, journal, audit, and
 * applicable FX changes together. Publishes events, requests any balance
 * propagation, and returns the account with opening-journal or balance
 * information.
 *
 * WHEN TO USE
 * Use to maintain petty-cash setup. A currency eligibility preview is advisory;
 * this operation also checks journal references and hierarchy compatibility.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/update-petty-cash-account.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import ILedgerAccountBalanceService from '@domain/ledger/types/ledger-account-balance.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { IPettyCashAccountUpdateReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { pettyCashUpdateReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import openingBalanceExchangeRateGetterHelper from '@app/ledger/usecases/helpers/opening-balance-exchange-rate-getter.helper';
import prepareOpeningBalanceEditHelper from '@app/ledger/usecases/helpers/prepare-opening-balance-edit.helper';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountBalanceService: ILedgerAccountBalanceService;
  cashAccountService: ICashAccountService;
  journalEntryRepo: IJournalEntryRepo;
  openingBalanceEntryService: IOpeningBalanceEntryService;
  fxLotAppService: IFxLotAppService;
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

      const openingBalance = payload.openingBalance;
      const openingBalanceEntryMutation = openingBalance
        ? await prepareOpeningBalanceEditHelper(
            deps,
            {
              accountingEntityId: accountingEntity.id,
              functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
              account,
              amount: moneyMapper.fromDto(openingBalance.amount),
              effectiveDate: openingBalance.date,
              exchangeRate:
                openingBalanceExchangeRateGetterHelper(openingBalance),
              createdBy: actor.id,
            },
            transactionOptions
          )
        : null;

      const journalEntry = openingBalanceEntryMutation?.currentJournalEntry;
      const postedJournal =
        journalEntry?.status === EJournalEntryStatus.Posted
          ? journalEntry
          : null;
      const fxAcquisition = postedJournal
        ? await deps.fxLotAppService.acquire(
            {
              journalEntry: postedJournal,
              account,
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

      if (
        openingBalanceEntryMutation &&
        (openingBalanceEntryMutation.entryUpdate ||
          openingBalanceEntryMutation.entriesToCreate.length > 0)
      ) {
        const journalPersistencePayload =
          getJournalEntryPersistencePayloadHelper(
            openingBalanceEntryMutation,
            actor.id,
            correlationId
          );
        await deps.journalEntryPersistenceAppService.rectify(
          journalPersistencePayload,
          transactionOptions
        );
      }

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition.records,
          transactionOptions
        );
      }

      if (postedJournal) {
        await deps.outboxAppService.createBalancePropagation(
          postedJournal.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events: IEvent<unknown>[] = [
        ...accountEvents,
        ...(openingBalanceEntryMutation?.events ?? []),
        ...(fxAcquisition?.events ?? []),
      ];
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );

      if (postedJournal) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: postedJournal.id,
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
