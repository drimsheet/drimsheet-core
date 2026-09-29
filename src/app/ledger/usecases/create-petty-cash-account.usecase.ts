import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import { TCashLedgerCode } from '@domain/ledger/types/ledger-code.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { IPettyCashAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { pettyCashCreationReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import finalizeWithoutOpeningBalanceWithAssignedCode from '@app/ledger/usecases/helpers/finalize-without-opening-balance-with-assigned-code.helper';
import getControlAccountHelper from '@app/ledger/usecases/helpers/get-control-account.helper';
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
  accountingPeriodService: IAccountingPeriodService;
  cashAccountService: ICashAccountService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryService: IJournalEntryService;
  journalEntryPersistenceService: IJournalEntryPersistenceService;
  outboxService: IOutboxService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceService: IFxCostBasisPersistenceService;
}

export default function makeCreatePettyCashAccountUseCase(deps: IDependencies) {
  return async (
    payload: IPettyCashAccountCreationReq
  ): Promise<ILedgerAccountDto> => {
    const { correlationId, actor, accountingEntity } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    // Validate data
    zodValidationRunner(pettyCashCreationReqValidation, payload);

    openingBalanceExchangeRateValidationHelper(
      accountingEntity.functionalCurrencyCode,
      payload.currencyCode,
      payload.openingBalance
    );

    if (payload.openingBalance?.date) {
      await deps.accountingPeriodService.validatePostingPeriod(
        accountingEntity.id,
        payload.openingBalance.date,
        repoOptions
      );
    }

    const controlAccount = await getControlAccountHelper<TCashLedgerCode>({
      ledgerAccountRepo: deps.ledgerAccountRepo,
      controlAccountId: payload.controlAccountId,
      defaultControlAccountCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      accountingEntityId: accountingEntity.id,
      repoOptions,
    });

    const auditedAccount =
      await deps.cashAccountService.createPettyCashSubAccount(
        {
          name: payload.name,
          currency: currencyEntity.getByCode(payload.currencyCode),
          isControlAccount: payload.isControlAccount,
          createdBy: actor.id,
          accountingEntity,
          controlAccountCode: controlAccount.code,
        },
        repoOptions
      );

    if (!payload.openingBalance) {
      return finalizeWithoutOpeningBalanceWithAssignedCode(deps, {
        auditedAccount,
        accountingEntity,
        allocationHeaderCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
        actor: actor.id,
        repoOptions,
      });
    }

    const exchangeRate = openingBalanceExchangeRateGetter(
      payload.openingBalance
    );

    const [journalEntry, journalEvents, journalAudit] =
      await deps.journalEntryService.createOpeningBalance(
        {
          accountingEntityId: accountingEntity.id,
          functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
          account: auditedAccount[0],
          amount: moneyMapper.fromDto(payload.openingBalance.amount),
          effectiveDate: payload.openingBalance.date,
          exchangeRate,
          createdBy: actor.id,
        },
        repoOptions
      );

    const openingBalanceUpdate = ledgerAccountEntity.updateOpeningBalanceDate(
      auditedAccount[0],
      payload.openingBalance.date
    );
    const [updatedAccount] = openingBalanceUpdate;

    // Make histories
    const initialAccountHistory = historyValue.make(
      auditedAccount[2],
      actor.id,
      correlationId
    );
    const updatedAccountHistory = historyValue.make(
      openingBalanceUpdate[2],
      actor.id,
      correlationId
    );
    const journalHeaderHistory = historyValue.make(
      journalAudit.header,
      actor.id,
      correlationId
    );
    const journalLineHistories = journalAudit.lines.map((lineAudit) =>
      historyValue.make(lineAudit, actor.id, correlationId)
    );

    const shouldUpdateBalance =
      journalEntry.status === EJournalEntryStatus.Posted;

    const fxResult = await deps.fxLotAppService.acquire(
      { journalEntry, account: updatedAccount, actor: actor.id },
      repoOptions
    );

    // Persist entities
    const dbTransactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
      tx
    ) => {
      const writeRepoOptions = { ...repoOptions, tx };

      const accountPersistencePayload = {
        account: updatedAccount,
        allocationHeaderCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
        actorId: actor.id,
      };

      const accountPersistenceRepoOptions = {
        ...writeRepoOptions,
        history: [initialAccountHistory, updatedAccountHistory],
      };

      const assignedAccount =
        await deps.ledgerAccountPersistenceService.createWithAssignedCode(
          accountPersistencePayload,
          accountingEntity.functionalCurrencyCode,
          accountPersistenceRepoOptions
        );

      await deps.journalEntryPersistenceService.create(
        journalEntry,
        journalHeaderHistory,
        journalLineHistories,
        writeRepoOptions
      );

      if (fxResult) {
        await deps.fxCostBasisPersistenceService.persistAcquisition(
          fxResult.records,
          writeRepoOptions
        );
      }

      if (shouldUpdateBalance) {
        await deps.outboxService.createBalancePropagation(
          journalEntry.id,
          writeRepoOptions
        );
      }

      return assignedAccount;
    };

    const assignedAccount =
      await deps.repoService.runInTransaction(dbTransactionFn);

    if (shouldUpdateBalance) {
      await deps.ledgerBalanceAdjustmentQueue.add({
        journalEntryId: journalEntry.id,
        correlationId,
      });
    }

    // Assemble events
    const allEvents: IEvent<unknown>[] = [
      ...auditedAccount[1],
      ...openingBalanceUpdate[1],
      ...assignedAccount.events,
      ...journalEvents,
      ...(fxResult?.events ?? []),
    ];

    await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

    return ledgerAccountToDtoMapperHelper(
      assignedAccount.account,
      journalEntry,
      accountingEntity.functionalCurrencyCode
    );
  };
}
