import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { ECounterpartyStatus } from '@domain/counterparty/types/counterparty.types';
import {
  ICreatePaymentEntryPayload,
  IJournalEntryService,
} from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ICounterpartyAppService from '@app/counterparty/contracts/counterparty.service.contract';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import { paymentEntryReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';
import getNewCounterpartiesHelper from '@app/journal-entry/helpers/get-new-counterparties.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  counterpartyAppService: ICounterpartyAppService;
  fileManagementAppService: IFileManagementAppService;
  journalEntryService: IJournalEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  counterpartyRepo: ICounterpartyRepo;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
  eventBus: IEventBus;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
}

export default function makeCreatePaymentUsecase(deps: IDependencies) {
  return async (payload: IPaymentEntryReq): Promise<IJournalEntryDto> => {
    zodValidationRunner(paymentEntryReqValidation, payload);

    const { correlationId, accountingEntity, user, actor, idempotencyKey } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);
    const repoOptions = { correlationId, idempotencyKey };

    const headerPayload: ICreatePaymentEntryPayload['header'] = {
      accountingEntityId: accountingEntity.id,
      memo: payload.memo,
      effectiveDate: payload.effectiveDate,
      postedAt: payload.postedAt,
      functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
      createdBy: actor.id,
    };

    const sourceAccount = await deps.ledgerAccountRepo.findById(
      payload.sourceLine.accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!sourceAccount) {
      throw new ledgerAppError.AccountNotFound({
        id: payload.sourceLine.accountId,
      });
    }

    const destinationAccounts: ILedgerAccount[] = [];

    for (const destinationLine of payload.destinationLines) {
      const destinationAccount = await deps.ledgerAccountRepo.findById(
        destinationLine.accountId as TEntityId,
        accountingEntity.id,
        repoOptions
      );

      if (!destinationAccount) {
        throw new ledgerAppError.AccountNotFound({
          id: destinationLine.accountId,
        });
      }

      destinationAccounts.push(destinationAccount);
    }

    const allCounterpartiesPayload = [
      payload.sourceLine.counterparty,
      ...payload.destinationLines.map((line) => line.counterparty),
    ];
    const allCounterparties =
      await deps.counterpartyAppService.findOrCreateMany(
        allCounterpartiesPayload,
        accountingEntity.id,
        actor.id,
        payload.postedAt === null
          ? ECounterpartyStatus.Draft
          : ECounterpartyStatus.Active,
        repoOptions
      );

    const sourceExchangeRate = payload.sourceLine.exchangeRate
      ? exchangeRateValue.make(payload.sourceLine.exchangeRate)
      : null;
    const sourceCounterparty =
      deps.counterpartyAppService.getFoundOrCreated(
        payload.sourceLine.counterparty,
        allCounterparties
      )?.data[0] ?? null;
    const sourceLinePayload: ICreatePaymentEntryPayload['sourceLine'] = {
      account: sourceAccount,
      counterparty: sourceCounterparty,
      sequenceOrder: payload.sourceLine.sequenceOrder,
      amount: moneyMapper.fromDto(payload.sourceLine.amount),
      exchangeRate: sourceExchangeRate,
      description: payload.sourceLine.description,
      meta: null,
    };

    const destinationLinesPayload: ICreatePaymentEntryPayload['destinationLines'] =
      payload.destinationLines.map((destinationLine, index) => {
        const exchangeRate = destinationLine.exchangeRate
          ? exchangeRateValue.make(destinationLine.exchangeRate)
          : null;
        const counterparty =
          deps.counterpartyAppService.getFoundOrCreated(
            destinationLine.counterparty,
            allCounterparties
          )?.data[0] ?? null;

        return {
          account: destinationAccounts[index],
          counterparty,
          sequenceOrder: destinationLine.sequenceOrder,
          amount: moneyMapper.fromDto(destinationLine.amount),
          exchangeRate,
          description: destinationLine.description,
          meta: null,
        };
      });

    const attachments = await deps.fileManagementAppService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences ?? [],
    });
    const paymentPayload: ICreatePaymentEntryPayload = {
      attachments,
      header: headerPayload,
      sourceLine: sourceLinePayload,
      destinationLines: destinationLinesPayload,
    };

    const [journalEntry, journalEntryEvents, journalEntryAudit] =
      await deps.journalEntryService.createPayment(paymentPayload, repoOptions);

    const journalHeaderHistory = historyValue.make(
      journalEntryAudit.header,
      actor.id,
      correlationId
    );
    const journalLinesHistory = journalEntryAudit.lines.map((line) =>
      historyValue.make(line, actor.id, correlationId)
    );
    const newCounterparties = getNewCounterpartiesHelper(
      allCounterparties,
      actor.id,
      correlationId
    );

    const shouldUpdateBalance =
      journalEntry.status === EJournalEntryStatus.Posted;

    const fxReadOptions: IReadRepoOptions = { correlationId };
    const fxResult = await deps.fxLotAppService.dispose(
      { journalEntry, account: sourceAccount, actor: actor.id },
      fxReadOptions
    );
    const fxEvents: IEvent<unknown>[] = fxResult?.events ?? [];

    const dbTransactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { correlationId, tx };

      const counterpartiesToSave = [];

      for (const [counterparty, history] of newCounterparties.records) {
        counterpartiesToSave.push(
          deps.counterpartyRepo.create(counterparty, {
            ...writeOptions,
            history,
          })
        );
      }

      await Promise.all(counterpartiesToSave);

      await deps.journalEntryPersistenceAppService.create(
        journalEntry,
        journalHeaderHistory,
        journalLinesHistory,
        writeOptions
      );

      if (fxResult) {
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          fxResult.records,
          writeOptions
        );
      }

      if (shouldUpdateBalance) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntry.id,
          writeOptions
        );
      }
    };

    await deps.repoService.runInTransaction(dbTransactionFn);

    if (shouldUpdateBalance) {
      await deps.ledgerBalanceAdjustmentQueue.add({
        journalEntryId: journalEntry.id,
        correlationId,
      });
    }

    const allEvents: IEvent<unknown>[] = [
      ...newCounterparties.events,
      ...journalEntryEvents,
      ...fxEvents,
    ];
    await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

    return journalEntryDtoMapper.toDto(journalEntry);
  };
}
