import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { IBankAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { bankAccountCreationReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import openingBalanceExchangeRateGetter from '@app/ledger/usecases/helpers/opening-balance-exchange-rate-getter.helper';
import openingBalanceExchangeRateValidationHelper from '@app/ledger/usecases/helpers/opening-balance-exchange-rate-validation.helper';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  cashAccountService: ICashAccountService;
  bankAccountRepo: IBankAccountRepo;
  openingBalanceEntryAppService: IOpeningBalanceEntryAppService;
  journalEntryPersistenceService: IJournalEntryPersistenceService;
  outboxService: IOutboxService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceService: IFxCostBasisPersistenceService;
}

export default function makeCreateBankAccountUseCase(deps: IDependencies) {
  return async (
    payload: IBankAccountCreationReq
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(bankAccountCreationReqValidation, payload);

    const { correlationId, actor, accountingEntity } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(payload.currencyCode);
    openingBalanceExchangeRateValidationHelper(
      accountingEntity.functionalCurrencyCode,
      payload.currencyCode,
      payload.openingBalance
    );

    const repoOptions = { correlationId };
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };

      const accountCreationInput = {
        name: payload.name,
        status: payload.status,
        currency,
        isControlAccount: false,
        createdBy: actor.id,
        accountingEntity,
        controlAccountId: payload.controlAccountId as TEntityId | undefined,
        openingBalanceDate: payload.openingBalance?.date,
        bankDetails: {
          countryCode: accountingEntity.jurisdictionCode,
          bankName: payload.bankAccount.bankName,
          accountName: payload.bankAccount.accountName,
          accountNumber: payload.bankAccount.accountNumber,
        },
      };

      const [account, accountEvents, accountAudit] =
        await deps.cashAccountService.createBankSubAccount(
          accountCreationInput,
          transactionOptions
        );

      const accountHistory = historyValue.make(
        accountAudit,
        actor.id,
        correlationId
      );

      if (!payload.openingBalance) {
        await deps.ledgerAccountPersistenceService.create(
          account,
          accountingEntity.functionalCurrencyCode,
          { ...transactionOptions, history: [accountHistory] }
        );

        await deps.bankAccountRepo.create(
          account.id,
          accountingEntity.id,
          account.meta as IBankDetails,
          actor.id,
          transactionOptions
        );

        await transaction.commit();
        await deps.eventBus.publish(
          eventValue.enrichAll(accountEvents, repoOptions)
        );

        return ledgerAccountToDtoMapperHelper(
          account,
          null,
          accountingEntity.functionalCurrencyCode
        );
      }

      const journalEntryCreationInput = {
        accountingEntityId: accountingEntity.id,
        functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
        account,
        amount: moneyMapper.fromDto(payload.openingBalance.amount),
        effectiveDate: payload.openingBalance.date,
        exchangeRate: openingBalanceExchangeRateGetter(payload.openingBalance),
        createdBy: actor.id,
      };

      const [journalEntry, journalEvents, journalAudit] =
        await deps.openingBalanceEntryAppService.createInitialOpeningBalance(
          journalEntryCreationInput,
          transactionOptions
        );

      const postedJournal =
        journalEntry.status === EJournalEntryStatus.Posted
          ? journalEntry
          : null;
      const fxAcquisition = postedJournal
        ? await deps.fxLotAppService.acquire(
            { journalEntry: postedJournal, account, actor: actor.id },
            transactionOptions
          )
        : null;

      const journalHeaderHistory = historyValue.make(
        journalAudit.header,
        actor.id,
        correlationId
      );
      const journalLineHistories = journalAudit.lines.map((audit) =>
        historyValue.make(audit, actor.id, correlationId)
      );

      await deps.ledgerAccountPersistenceService.create(
        account,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [accountHistory] }
      );

      await deps.bankAccountRepo.create(
        account.id,
        accountingEntity.id,
        account.meta as IBankDetails,
        actor.id,
        transactionOptions
      );

      await deps.journalEntryPersistenceService.create(
        journalEntry,
        journalHeaderHistory,
        journalLineHistories,
        transactionOptions
      );

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceService.persistAcquisition(
          fxAcquisition.records,
          transactionOptions
        );
      }

      if (postedJournal) {
        await deps.outboxService.createBalancePropagation(
          postedJournal.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events: IEvent<unknown>[] = [
        ...accountEvents,
        ...journalEvents,
        ...(fxAcquisition?.events ?? []),
      ];
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      if (postedJournal) {
        await deps.ledgerBalanceAdjustmentQueue.add({
          journalEntryId: postedJournal.id,
          correlationId,
        });
      }

      return ledgerAccountToDtoMapperHelper(
        account,
        journalEntry,
        accountingEntity.functionalCurrencyCode
      );
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
