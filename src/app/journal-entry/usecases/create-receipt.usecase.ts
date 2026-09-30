import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { ECounterpartyStatus } from '@domain/counterparty/types/counterparty.types';
import {
  ICreateReceiptEntryPayload,
  IJournalEntryService,
} from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ICounterpartyAppService from '@app/counterparty/contracts/counterparty.service.contract';
import IFileManagementService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { receiptEntryReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';
import getNewCounterpartiesHelper from '@app/journal-entry/helpers/get-new-counterparties.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  counterpartyAppService: ICounterpartyAppService;
  fileManagementService: IFileManagementService;
  journalEntryService: IJournalEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  counterpartyRepo: ICounterpartyRepo;
  journalEntryPersistenceService: IJournalEntryPersistenceService;
  repoService: IRepoService;
  eventBus: IEventBus;
  outboxService: IOutboxService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceService: IFxCostBasisPersistenceService;
}

export default function makeCreateReceiptUsecase(deps: IDependencies) {
  return async (payload: IReceiptEntryReq): Promise<IJournalEntryDto> => {
    zodValidationRunner(receiptEntryReqValidation, payload);

    const { correlationId, accountingEntity, user, actor, idempotencyKey } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const headerPayload: ICreateReceiptEntryPayload['header'] = {
      accountingEntityId: accountingEntity.id,
      memo: payload.memo,
      effectiveDate: payload.effectiveDate,
      postedAt: payload.postedAt,
      functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
      createdBy: actor.id,
    };

    const sourceAccounts: ILedgerAccount[] = [];

    for (const sourceLine of payload.sourceLines) {
      const sourceAccount = await deps.ledgerAccountRepo.findById(
        sourceLine.accountId as TEntityId,
        accountingEntity.id,
        repoOptions
      );

      if (!sourceAccount) {
        throw new ledgerAppError.AccountNotFound({
          id: sourceLine.accountId,
        });
      }

      sourceAccounts.push(sourceAccount);
    }

    const allCounterpartiesPayload = payload.sourceLines
      .map((sourceLine) => sourceLine.counterparty)
      .concat(payload.destinationLine.counterparty)
      .filter(Boolean);

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

    const destinationAccount = await deps.ledgerAccountRepo.findById(
      payload.destinationLine.accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!destinationAccount) {
      throw new ledgerAppError.AccountNotFound({
        id: payload.destinationLine.accountId,
      });
    }

    const sourceLinesPayload: ICreateReceiptEntryPayload['sourceLines'] =
      payload.sourceLines.map((sourceLine, index) => {
        const sourceExchangeRate = sourceLine.exchangeRate
          ? exchangeRateValue.make(sourceLine.exchangeRate)
          : null;

        const sourceLineCounterparty =
          deps.counterpartyAppService.getFoundOrCreated(
            sourceLine.counterparty,
            allCounterparties
          )?.data[0] ?? null;

        return {
          account: sourceAccounts[index],
          counterparty: sourceLineCounterparty,
          sequenceOrder: sourceLine.sequenceOrder,
          amount: moneyMapper.fromDto(sourceLine.amount),
          exchangeRate: sourceExchangeRate,
          description: sourceLine.description,
          meta: null,
        };
      });

    const destinationExchangeRate = payload.destinationLine.exchangeRate
      ? exchangeRateValue.make(payload.destinationLine.exchangeRate)
      : null;

    const destinationLineCounterparty =
      deps.counterpartyAppService.getFoundOrCreated(
        payload.destinationLine.counterparty,
        allCounterparties
      )?.data[0] ?? null;

    const destinationLinePayload: ICreateReceiptEntryPayload['destinationLine'] =
      {
        account: destinationAccount,
        counterparty: destinationLineCounterparty,
        sequenceOrder: payload.destinationLine.sequenceOrder,
        amount: moneyMapper.fromDto(payload.destinationLine.amount),
        exchangeRate: destinationExchangeRate,
        description: payload.destinationLine.description,
        meta: null,
      };

    const attachments = await deps.fileManagementService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences ?? [],
    });

    const receiptPayload: ICreateReceiptEntryPayload = {
      attachments,
      header: headerPayload,
      sourceLines: sourceLinesPayload,
      destinationLine: destinationLinePayload,
    };

    const [journalEntry, journalEntryEvents, journalEntryAudit] =
      await deps.journalEntryService.createReceipt(receiptPayload, repoOptions);

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

    const fxResult = await deps.fxLotAppService.acquire(
      { journalEntry, account: destinationAccount, actor: actor.id },
      repoOptions
    );

    const dbTransactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { correlationId, tx };

      for (const counterpartyWithHistory of newCounterparties.records) {
        const [counterparty, history] = counterpartyWithHistory;
        await deps.counterpartyRepo.create(counterparty, {
          ...writeOptions,
          history,
        });
      }

      await deps.journalEntryPersistenceService.create(
        journalEntry,
        journalHeaderHistory,
        journalLinesHistory,
        writeOptions
      );

      if (fxResult) {
        await deps.fxCostBasisPersistenceService.persistAcquisition(
          fxResult.records,
          writeOptions
        );
      }

      if (shouldUpdateBalance) {
        await deps.outboxService.createBalancePropagation(
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
      ...(fxResult?.events ?? []),
    ];

    await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

    return journalEntryDtoMapper.toDto(journalEntry);
  };
}
