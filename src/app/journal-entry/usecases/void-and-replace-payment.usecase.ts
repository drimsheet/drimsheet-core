/**
 * Voids and reverses a posted payment and records a draft or posted
 * replacement. Journal changes, audits, FX effects, and balance outbox
 * records commit together. Returns the replacement payment.
 * Omitted upload references carry forward the original attachments.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IJournalEntryLinePayload } from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { IPaymentEntryService } from '@domain/journal-entry/types/payment-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import { paymentEntryReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-counterparties.helper';
import getJournalAccountsHelper from '@app/journal-entry/usecases/helpers/get-journal-accounts.helper';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  fileManagementAppService: IFileManagementAppService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryRepo: IJournalEntryRepo;
  paymentEntryService: IPaymentEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeVoidAndReplacePaymentUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IPaymentEntryReq
  ): Promise<IJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(paymentEntryReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey, user } =
      deps.appContext.get(['actor', 'accountingEntity', 'user']);
    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );
    const originalEntry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const requestedLines = [payload.sourceLine, ...payload.destinationLines];
    const counterparties = await getCounterpartiesHelper({
      ids: requestedLines.map((line) => line.counterpartyId),
      accountingEntityId: accountingEntity.id,
      repo: deps.counterpartyRepo,
      repoOptions,
    });
    const attachments =
      payload.attachmentReferences === undefined
        ? originalEntry.attachments
        : await deps.fileManagementAppService.claimUploads({
            userId: user.id,
            purpose: EFileUploadPurpose.JournalEntryAttachment,
            references: payload.attachmentReferences,
          });

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const lockedReadOptions = {
        ...transactionOptions,
        lock: ERepoLock.Share,
      };

      // The accounts and posting periods must stay eligible through commit.
      const accounts = await getJournalAccountsHelper({
        accountingEntityId: accountingEntity.id,
        lines: requestedLines,
        repo: deps.ledgerAccountRepo,
        repoOptions: lockedReadOptions,
      });
      const [sourceLine, ...destinationLines] = requestedLines.map(
        (line): IJournalEntryLinePayload => {
          const account = accounts.find(
            (candidate) => candidate.id === line.accountId
          );
          if (!account) {
            throw new ledgerAppError.AccountNotFound({ id: line.accountId });
          }

          return {
            account,
            counterparty: counterparties.find(
              (candidate) => candidate.id === line.counterpartyId
            )!,
            sequenceOrder: line.sequenceOrder,
            amount: moneyMapper.fromDto(line.amount),
            exchangeRate: line.exchangeRate
              ? exchangeRateValue.make(line.exchangeRate)
              : null,
            description: line.description,
            meta: null,
          };
        }
      );

      const correction = await deps.paymentEntryService.voidAndReplace(
        originalEntry,
        {
          header: {
            accountingEntityId: accountingEntity.id,
            effectiveDate: payload.effectiveDate,
            postedAt: payload.postedAt,
            memo: payload.memo,
            functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
            createdBy: actor.id,
          },
          sourceLine,
          destinationLines,
          attachments,
        },
        lockedReadOptions
      );
      const { voided, reversal, replacement } = correction;
      const [voidedEntry, voidEvents, voidAudit] = voided;
      const hasCorrection =
        reversal !== null && replacement !== null && voidAudit !== null;
      if (!hasCorrection) {
        await transaction.commit();
        return journalEntryDtoMapper.toDto(voidedEntry);
      }

      const [reversingEntry, reversalEvents] = reversal;
      const [entry, replacementEvents] = replacement;
      const isReplacementPosted = entry.status === EJournalEntryStatus.Posted;
      const persistence = getJournalEntryPersistencePayloadHelper(
        {
          entriesToCreate: [reversal, replacement],
          entryUpdate: {
            entry: voidedEntry,
            expectedVersion: originalEntry.version,
            headerAudit: voidAudit,
            lineAudits: [],
            linesToCreate: [],
            linesToUpdate: [],
            lineIdsToDelete: [],
          },
        },
        actor.id,
        correlationId
      );
      const fxReversal = await deps.fxCostBasisLotService.reverse(
        originalEntry.id,
        repoOptions
      );
      const officialRate = isReplacementPosted
        ? await resolveOfficialRateHelper(
            deps.exchangeRateAppService,
            entry.lines,
            sourceLine.account.id,
            repoOptions
          )
        : null;

      await deps.journalEntryPersistenceAppService.rectify(
        persistence,
        transactionOptions
      );

      if (fxReversal) {
        await deps.fxCostBasisPersistenceAppService.persistReversal(
          fxReversal,
          actor.id,
          transactionOptions
        );
      }

      // FIFO must see the restored lots and their new versions in this transaction.
      const fxDisposition = isReplacementPosted
        ? await deps.fxCostBasisLotService.dispose(
            {
              journalEntry: entry,
              account: sourceLine.account,
              createdBy: actor.id,
              officialRate,
            },
            transactionOptions
          )
        : null;
      if (fxDisposition) {
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          fxDisposition,
          actor.id,
          transactionOptions
        );
      }

      const journalEntryIds = isReplacementPosted
        ? [reversingEntry.id, entry.id]
        : [reversingEntry.id];
      for (const journalEntryId of journalEntryIds) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntryId,
          transactionOptions
        );
      }

      await transaction.commit();

      const events = [
        ...voidEvents,
        ...reversalEvents,
        ...replacementEvents,
        ...getFxLotEventsHelper(fxReversal),
        ...getFxLotEventsHelper(fxDisposition),
      ];
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      for (const journalEntryId of journalEntryIds) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId,
        });
      }

      return journalEntryDtoMapper.toDto(entry);
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
