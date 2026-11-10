/**
 * SUMMARY
 * Creates a payment journal for the selected accounting entity, with one source
 * and one or more destination lines. A null postedAt creates a draft; a posting
 * date requests a posted entry. Resolves counterparty IDs and claims the user's
 * attachment uploads. Saves the journal, audit history, applicable
 * foreign-exchange disposition, and pending balance work together.
 * Requests balance processing for posted entries, publishes events, and returns
 * the journal; derived balances are updated separately.
 *
 * WHEN TO USE
 * Use to record a new outgoing payment. Use post-draft-payment to post an
 * existing draft without changing its financial content.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/create-payment.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import {
  ICreatePaymentEntryPayload,
  IPaymentEntryService,
} from '@domain/journal-entry/types/payment-entry.service.types';
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
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import { paymentEntryReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';
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
  paymentEntryService: IPaymentEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
  eventBus: IEventBus;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
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

    const counterpartyIds = [
      payload.sourceLine.counterpartyId,
      ...payload.destinationLines.map((line) => line.counterpartyId),
    ];
    const allCounterparties = await getCounterpartiesHelper({
      ids: counterpartyIds,
      accountingEntityId: accountingEntity.id,
      repo: deps.counterpartyRepo,
      repoOptions,
    });

    const sourceExchangeRate = payload.sourceLine.exchangeRate
      ? exchangeRateValue.make(payload.sourceLine.exchangeRate)
      : null;
    const sourceCounterparty = allCounterparties.find(
      (candidate) => candidate.id === payload.sourceLine.counterpartyId
    )!;
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
        const counterparty = allCounterparties.find(
          (candidate) => candidate.id === destinationLine.counterpartyId
        )!;

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
      await deps.paymentEntryService.create(paymentPayload, repoOptions);

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

    const fxReadOptions: IReadRepoOptions = { correlationId };
    const fxResult = shouldUpdateBalance
      ? await deps.fxCostBasisLotService.dispose(
          {
            journalEntry,
            account: sourceAccount,
            createdBy: actor.id,
            officialRate: await resolveOfficialRateHelper(
              deps.exchangeRateAppService,
              journalEntry.lines,
              sourceAccount.id,
              fxReadOptions
            ),
          },
          fxReadOptions
        )
      : null;
    const fxEvents: IEvent<unknown>[] = getFxLotEventsHelper(fxResult);

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
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          fxResult,
          actor.id,
          writeOptions
        );
      }

      await transaction.commit();

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
