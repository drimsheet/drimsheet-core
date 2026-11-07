/**
 * SUMMARY
 * Creates a transfer journal between source and destination accounts in the
 * selected accounting entity, including any charge lines. Supports draft
 * creation through a null postedAt or posting through a supplied date. Resolves
 * charge counterparty IDs and claims the user's attachment uploads. Saves the
 * journal, audits, applicable foreign-exchange disposition and acquisition,
 * and pending balance work together. Requests balance
 * processing for posted entries, publishes events, and returns the journal.
 *
 * WHEN TO USE
 * Use to record a new transfer between accounts, including associated charges.
 * Use post-draft-transfer for an existing draft; derived balances update after
 * posting through separate processing.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/create-transfer.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import {
  ICreateTransferEntryPayload,
  ITransferEntryService,
} from '@domain/journal-entry/types/transfer-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import { transferEntryReqValidation } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto.validation';
import getLedgerAccountHelper from '@app/journal-entry/usecases/helpers/account-getter.helper';
import getCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-counterparties.helper';
import getTransferChargeAccountsHelper from '@app/journal-entry/usecases/helpers/get-transfer-charge-accounts.helper';
import getTransferDestinationLinePayloadHelper from '@app/journal-entry/usecases/helpers/get-transfer-destination-line-payload.helper';
import getTransferSourceLinePayloadHelper from '@app/journal-entry/usecases/helpers/get-transfer-source-line-payload.helper';
import transformTransferChargeLinesToJournalLinesHelper from '@app/journal-entry/usecases/helpers/transform-transfer-charge-lines-to-journal-lines.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  fileManagementAppService: IFileManagementAppService;
  transferEntryService: ITransferEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
  eventBus: IEventBus;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
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

    const chargeAccounts = await getTransferChargeAccountsHelper(
      payload.chargeLines,
      accountingEntity,
      deps.ledgerAccountRepo,
      repoOptions
    );

    const chargeCounterpartyIds = payload.chargeLines.map(
      (line) => line.counterpartyId
    );
    const allCounterparties = await getCounterpartiesHelper({
      ids: chargeCounterpartyIds,
      accountingEntityId: accountingEntity.id,
      repo: deps.counterpartyRepo,
      repoOptions,
    });

    const destinationLinePayload = getTransferDestinationLinePayloadHelper(
      payload,
      destinationAccount
    );

    const chargeLinePayloads = transformTransferChargeLinesToJournalLinesHelper(
      payload,
      allCounterparties,
      chargeAccounts
    );

    const attachments = await deps.fileManagementAppService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences ?? [],
    });

    const sourceLinePayload = getTransferSourceLinePayloadHelper(
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
    } = await deps.transferEntryService.create(transferPayload, repoOptions);

    const journalHeaderHistory = historyValue.make(
      journalEntryAudit.header,
      actor.id,
      correlationId
    );
    const journalLinesHistory = journalEntryAudit.lines.map((line) =>
      historyValue.make(line, actor.id, correlationId)
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

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { correlationId, tx: transaction.context };

      await deps.journalEntryPersistenceAppService.create(
        journalEntry,
        journalHeaderHistory,
        journalLinesHistory,
        writeOptions
      );

      if (dispositionResult) {
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          dispositionResult.records,
          writeOptions
        );
      }

      if (acquisitionResult) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          acquisitionResult.records,
          writeOptions
        );
      }

      if (shouldUpdateBalance) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntry.id,
          writeOptions
        );
      }

      await transaction.commit();

      const fxEvents: IEvent<unknown>[] = [
        ...(dispositionResult?.events ?? []),
        ...(acquisitionResult?.events ?? []),
      ];

      const allEvents: IEvent<unknown>[] = [...journalEntryEvents, ...fxEvents];
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
