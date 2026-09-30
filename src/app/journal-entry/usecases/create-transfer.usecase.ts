import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { ECounterpartyStatus } from '@domain/counterparty/types/counterparty.types';
import {
  ICreateTransferEntryPayload,
  IJournalEntryService,
} from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ICounterpartyAppService from '@app/counterparty/contracts/counterparty.service.contract';
import IFileManagementService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import { transferEntryReqValidation } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto.validation';
import getLedgerAccountHelper from '@app/journal-entry/helpers/account-getter.helper';
import getNewCounterpartiesHelper from '@app/journal-entry/helpers/get-new-counterparties.helper';
import helpers from '@app/journal-entry/helpers/transfer-entry.helpers';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
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

export default function makeCreateTransferUsecase(deps: IDependencies) {
  return async (payload: ITransferEntryReq): Promise<IJournalEntryDto> => {
    zodValidationRunner(transferEntryReqValidation, payload);

    const { correlationId, accountingEntity, user, actor, idempotencyKey } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const sourceAccount = await getLedgerAccountHelper({
      id: payload.sourceLine.accountId,
      accountingEntityId: accountingEntity.id,
      repo: deps.ledgerAccountRepo,
      repoOptions,
    });

    const destinationAccount = await getLedgerAccountHelper({
      id: payload.destinationLine.accountId,
      accountingEntityId: accountingEntity.id,
      repo: deps.ledgerAccountRepo,
      repoOptions,
    });

    const chargeAccounts = await helpers.getChargeAccounts(
      payload.chargeLines,
      accountingEntity,
      deps.ledgerAccountRepo,
      repoOptions
    );

    const chargeCounterpartiesPayload = payload.chargeLines.flatMap((line) =>
      line.counterparty ? [line.counterparty] : []
    );
    const allCounterparties =
      await deps.counterpartyAppService.findOrCreateMany(
        chargeCounterpartiesPayload,
        accountingEntity.id,
        actor.id,
        payload.postedAt === null
          ? ECounterpartyStatus.Draft
          : ECounterpartyStatus.Active,
        repoOptions
      );

    const destinationLinePayload = helpers.getDestinationPayload(
      payload,
      destinationAccount
    );

    const chargeLinePayloads = helpers.transformChargeLineToJournalLine(
      payload,
      allCounterparties,
      chargeAccounts,
      deps.counterpartyAppService
    );

    const attachments = await deps.fileManagementService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences ?? [],
    });

    const sourceLinePayload = helpers.getSourceLinePayload(
      payload,
      sourceAccount
    );

    const headerPayload = {
      accountingEntityId: accountingEntity.id,
      memo: payload.memo,
      effectiveDate: payload.effectiveDate,
      postedAt: payload.postedAt,
      functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
      createdBy: actor.id,
    };

    const transferPayload: ICreateTransferEntryPayload = {
      attachments,
      header: headerPayload,
      sourceLine: sourceLinePayload,
      destinationLines: [destinationLinePayload, ...chargeLinePayloads],
    };

    const {
      journalEntry: [journalEntry, journalEntryEvents, journalEntryAudit],
      destinationAssetAccount,
    } = await deps.journalEntryService.createTransfer(
      transferPayload,
      repoOptions
    );

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

    const dispositionResult = await deps.fxLotAppService.dispose(
      { journalEntry, account: sourceAccount, actor: actor.id },
      repoOptions
    );
    const acquisitionResult = await deps.fxLotAppService.acquire(
      { journalEntry, account: destinationAssetAccount, actor: actor.id },
      repoOptions
    );

    const shouldUpdateBalance =
      journalEntry.status === EJournalEntryStatus.Posted;

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

      if (dispositionResult) {
        await deps.fxCostBasisPersistenceService.persistDisposition(
          dispositionResult.records,
          writeOptions
        );
      }

      if (acquisitionResult) {
        await deps.fxCostBasisPersistenceService.persistAcquisition(
          acquisitionResult.records,
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

    const fxEvents: IEvent<unknown>[] = [
      ...(dispositionResult?.events ?? []),
      ...(acquisitionResult?.events ?? []),
    ];

    const allEvents: IEvent<unknown>[] = [
      ...newCounterparties.events,
      ...journalEntryEvents,
      ...fxEvents,
    ];
    await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

    return journalEntryDtoMapper.toDto(journalEntry);
  };
}
