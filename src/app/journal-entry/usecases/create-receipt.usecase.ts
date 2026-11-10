/**
 * SUMMARY
 * Creates a receipt journal for the selected accounting entity, with one or
 * more source lines and one destination. A null postedAt creates a draft; a
 * posting date requests a posted entry. Resolves counterparty IDs and claims the
 * user's attachment uploads. Saves the journal, audit history, applicable
 * foreign-exchange acquisition, and pending balance work together. Requests
 * balance processing for posted entries, publishes events,
 * and returns the journal; derived balances are updated separately.
 *
 * WHEN TO USE
 * Use to record a new incoming receipt. Use post-draft-receipt to post an
 * existing draft without changing its financial content.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/create-receipt.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import {
  ICreateReceiptEntryPayload,
  IReceiptEntryService,
} from '@domain/journal-entry/types/receipt-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { receiptEntryReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';
import getCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-counterparties.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  fileManagementAppService: IFileManagementAppService;
  receiptEntryService: IReceiptEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
  eventBus: IEventBus;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
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

    const counterpartyIds = payload.sourceLines
      .map((sourceLine) => sourceLine.counterpartyId)
      .concat(payload.destinationLine.counterpartyId);

    const allCounterparties = await getCounterpartiesHelper({
      ids: counterpartyIds,
      accountingEntityId: accountingEntity.id,
      repo: deps.counterpartyRepo,
      repoOptions,
    });

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

        const sourceLineCounterparty = allCounterparties.find(
          (candidate) => candidate.id === sourceLine.counterpartyId
        )!;

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

    const destinationLineCounterparty = allCounterparties.find(
      (candidate) => candidate.id === payload.destinationLine.counterpartyId
    )!;

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

    const attachments = await deps.fileManagementAppService.claimUploads({
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
      await deps.receiptEntryService.create(receiptPayload, repoOptions);

    const journalHeaderHistory = historyValue.make(
      journalEntryAudit.header,
      actor.id,
      correlationId
    );
    const journalLinesHistory = journalEntryAudit.lines.map((line) =>
      historyValue.make(line, actor.id, correlationId)
    );

    const shouldUpdateBalance =
      journalEntry.status === EJournalEntryStatus.Posted;

    const fxResult = shouldUpdateBalance
      ? deps.fxCostBasisLotService.acquire({
          journalEntry,
          account: destinationAccount,
          createdBy: actor.id,
          officialRate: await resolveOfficialRateHelper(
            deps.exchangeRateAppService,
            journalEntry.lines,
            destinationAccount.id,
            repoOptions
          ),
        })
      : null;

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { correlationId, tx: transaction.context };

      await deps.journalEntryPersistenceAppService.create(
        journalEntry,
        journalHeaderHistory,
        journalLinesHistory,
        writeOptions
      );

      if (fxResult) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxResult,
          actor.id,
          writeOptions
        );
      }

      await transaction.commit();

      const allEvents: IEvent<unknown>[] = [
        ...journalEntryEvents,
        ...getFxLotEventsHelper(fxResult),
      ];

      await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

      if (shouldUpdateBalance) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: journalEntry.id,
        });
      }

      return journalEntryDtoMapper.toDto(journalEntry);
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
