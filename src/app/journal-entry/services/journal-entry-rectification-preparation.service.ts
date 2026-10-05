import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { ECounterpartyStatus } from '@domain/counterparty/types/counterparty.types';
import {
  EJournalEntryRectificationMode,
  IJournalEntryRectificationResult,
  IJournalEntryRectificationService,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  ICreatePaymentEntryPayload,
  ICreateReceiptEntryPayload,
  ICreateTransferEntryPayload,
  IJournalEntryService,
} from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import ICounterpartyAppService, {
  ICounterpartyFindOrCreateRes,
} from '@app/counterparty/contracts/counterparty.service.contract';
import IJournalEntryRectificationPreparationService, {
  IJournalEntryRectificationPreparationPayload,
} from '@app/journal-entry/contracts/journal-entry-rectification-preparation.service.contract';
import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import getLedgerAccount from '@app/journal-entry/helpers/account-getter.helper';
import transferHelpers from '@app/journal-entry/helpers/transfer-entry.helpers';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';
import {
  TFxLotAcquisitionAppResult,
  TFxLotDispositionAppResult,
  TFxLotReversalAppResult,
} from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

interface IDependencies {
  counterpartyAppService: ICounterpartyAppService;
  journalEntryService: IJournalEntryService;
  journalEntryRectificationService: IJournalEntryRectificationService;
  ledgerAccountRepo: ILedgerAccountRepo;
  fxLotAppService: IFxLotAppService;
}

interface IPreparedSourceJournalEntry {
  journalEntry: IJournalEntry;
  counterparties: Map<string, ICounterpartyFindOrCreateRes>;
  sourceAccount: ILedgerAccount;
  destinationAssetAccount: ILedgerAccount;
}

interface IPreparedFxRectification {
  fxReversal: TFxLotReversalAppResult | null;
  fxDisposition: TFxLotDispositionAppResult | null;
  fxAcquisition: TFxLotAcquisitionAppResult | null;
}

type TPaymentRectificationReq = Extract<
  TJournalEntryRectificationReq,
  { sourceType: typeof EJournalEntrySourceType.Payment }
>;

type TReceiptRectificationReq = Extract<
  TJournalEntryRectificationReq,
  { sourceType: typeof EJournalEntrySourceType.Receipt }
>;

type TTransferRectificationReq = Extract<
  TJournalEntryRectificationReq,
  { sourceType: typeof EJournalEntrySourceType.Transfer }
>;

function getExchangeRate(exchangeRate: IExchangeRateDto | null) {
  return exchangeRate ? exchangeRateValue.make(exchangeRate) : null;
}

function getHeader(
  preparation: IJournalEntryRectificationPreparationPayload
): ICreatePaymentEntryPayload['header'] {
  const { requestedEntry, originalEntry, accountingEntity, actor } =
    preparation;

  return {
    accountingEntityId: accountingEntity.id,
    functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
    createdBy: actor,
    effectiveDate: requestedEntry.effectiveDate,
    postedAt:
      originalEntry.status === EJournalEntryStatus.Posted
        ? originalEntry.postedAt
        : requestedEntry.postedAt,
    memo: requestedEntry.memo,
  };
}

function retainRequestedLineIds(
  journalEntry: IJournalEntry,
  requestedLineIds: (TEntityId | null)[]
): IJournalEntry {
  return Object.freeze({
    ...journalEntry,
    lines: journalEntry.lines.map((line, index) =>
      Object.freeze({
        ...line,
        id: requestedLineIds[index] ?? line.id,
      })
    ),
  });
}

async function preparePayment(
  deps: IDependencies,
  preparation: IJournalEntryRectificationPreparationPayload & {
    requestedEntry: TPaymentRectificationReq;
  },
  repoOptions: IReadRepoOptions
): Promise<IPreparedSourceJournalEntry> {
  const { requestedEntry, accountingEntity } = preparation;
  const sourceAccount = await getLedgerAccount({
    id: requestedEntry.sourceLine.accountId,
    accountingEntityId: accountingEntity.id,
    repo: deps.ledgerAccountRepo,
    repoOptions,
  });
  const destinationAccounts: ILedgerAccount[] = [];

  for (const destinationLine of requestedEntry.destinationLines) {
    const destinationAccount = await getLedgerAccount({
      id: destinationLine.accountId,
      accountingEntityId: accountingEntity.id,
      repo: deps.ledgerAccountRepo,
      repoOptions,
    });
    destinationAccounts.push(destinationAccount);
  }

  const counterparties = await deps.counterpartyAppService.findOrCreateMany(
    [
      requestedEntry.sourceLine.counterparty,
      ...requestedEntry.destinationLines.map((line) => line.counterparty),
    ],
    accountingEntity.id,
    preparation.actor,
    getHeader(preparation).postedAt === null
      ? ECounterpartyStatus.Draft
      : ECounterpartyStatus.Active,
    repoOptions
  );
  const sourceCounterparty =
    deps.counterpartyAppService.getFoundOrCreated(
      requestedEntry.sourceLine.counterparty,
      counterparties
    )?.data[0] ?? null;
  const paymentPayload: ICreatePaymentEntryPayload = {
    header: getHeader(preparation),
    attachments: requestedEntry.attachments,
    sourceLine: {
      account: sourceAccount,
      counterparty: sourceCounterparty,
      sequenceOrder: requestedEntry.sourceLine.sequenceOrder,
      amount: moneyMapper.fromDto(requestedEntry.sourceLine.amount),
      exchangeRate: getExchangeRate(requestedEntry.sourceLine.exchangeRate),
      description: requestedEntry.sourceLine.description,
      meta: null,
    },
    destinationLines: requestedEntry.destinationLines.map((line, index) => ({
      account: destinationAccounts[index],
      counterparty:
        deps.counterpartyAppService.getFoundOrCreated(
          line.counterparty,
          counterparties
        )?.data[0] ?? null,
      sequenceOrder: line.sequenceOrder,
      amount: moneyMapper.fromDto(line.amount),
      exchangeRate: getExchangeRate(line.exchangeRate),
      description: line.description,
      meta: null,
    })),
  };
  const [journalEntry] = await deps.journalEntryService.createPayment(
    paymentPayload,
    repoOptions
  );
  const requestedLineIds = [
    (requestedEntry.sourceLine.id as TEntityId | undefined) ?? null,
    ...requestedEntry.destinationLines.map(
      (line) => (line.id as TEntityId | undefined) ?? null
    ),
  ];

  return {
    journalEntry: retainRequestedLineIds(journalEntry, requestedLineIds),
    counterparties,
    sourceAccount,
    destinationAssetAccount: destinationAccounts[0],
  };
}

async function prepareReceipt(
  deps: IDependencies,
  preparation: IJournalEntryRectificationPreparationPayload & {
    requestedEntry: TReceiptRectificationReq;
  },
  repoOptions: IReadRepoOptions
): Promise<IPreparedSourceJournalEntry> {
  const { requestedEntry, accountingEntity } = preparation;
  const sourceAccounts: ILedgerAccount[] = [];

  for (const sourceLine of requestedEntry.sourceLines) {
    const sourceAccount = await getLedgerAccount({
      id: sourceLine.accountId,
      accountingEntityId: accountingEntity.id,
      repo: deps.ledgerAccountRepo,
      repoOptions,
    });
    sourceAccounts.push(sourceAccount);
  }

  const destinationAccount = await getLedgerAccount({
    id: requestedEntry.destinationLine.accountId,
    accountingEntityId: accountingEntity.id,
    repo: deps.ledgerAccountRepo,
    repoOptions,
  });
  const counterparties = await deps.counterpartyAppService.findOrCreateMany(
    [
      ...requestedEntry.sourceLines.map((line) => line.counterparty),
      requestedEntry.destinationLine.counterparty,
    ],
    accountingEntity.id,
    preparation.actor,
    getHeader(preparation).postedAt === null
      ? ECounterpartyStatus.Draft
      : ECounterpartyStatus.Active,
    repoOptions
  );
  const receiptPayload: ICreateReceiptEntryPayload = {
    header: getHeader(preparation),
    attachments: requestedEntry.attachments,
    sourceLines: requestedEntry.sourceLines.map((line, index) => ({
      account: sourceAccounts[index],
      counterparty:
        deps.counterpartyAppService.getFoundOrCreated(
          line.counterparty,
          counterparties
        )?.data[0] ?? null,
      sequenceOrder: line.sequenceOrder,
      amount: moneyMapper.fromDto(line.amount),
      exchangeRate: getExchangeRate(line.exchangeRate),
      description: line.description,
      meta: null,
    })),
    destinationLine: {
      account: destinationAccount,
      counterparty:
        deps.counterpartyAppService.getFoundOrCreated(
          requestedEntry.destinationLine.counterparty,
          counterparties
        )?.data[0] ?? null,
      sequenceOrder: requestedEntry.destinationLine.sequenceOrder,
      amount: moneyMapper.fromDto(requestedEntry.destinationLine.amount),
      exchangeRate: getExchangeRate(
        requestedEntry.destinationLine.exchangeRate
      ),
      description: requestedEntry.destinationLine.description,
      meta: null,
    },
  };
  const [journalEntry] = await deps.journalEntryService.createReceipt(
    receiptPayload,
    repoOptions
  );
  const requestedLineIds = [
    ...requestedEntry.sourceLines.map(
      (line) => (line.id as TEntityId | undefined) ?? null
    ),
    (requestedEntry.destinationLine.id as TEntityId | undefined) ?? null,
  ];

  return {
    journalEntry: retainRequestedLineIds(journalEntry, requestedLineIds),
    counterparties,
    sourceAccount: sourceAccounts[0],
    destinationAssetAccount: destinationAccount,
  };
}

async function prepareTransfer(
  deps: IDependencies,
  preparation: IJournalEntryRectificationPreparationPayload & {
    requestedEntry: TTransferRectificationReq;
  },
  repoOptions: IReadRepoOptions
): Promise<IPreparedSourceJournalEntry> {
  const { requestedEntry, accountingEntity } = preparation;
  const sourceAccount = await getLedgerAccount({
    id: requestedEntry.sourceLine.accountId,
    accountingEntityId: accountingEntity.id,
    repo: deps.ledgerAccountRepo,
    repoOptions,
  });
  const destinationAccount = await getLedgerAccount({
    id: requestedEntry.destinationLine.accountId,
    accountingEntityId: accountingEntity.id,
    repo: deps.ledgerAccountRepo,
    repoOptions,
  });
  const chargeAccounts = await transferHelpers.getChargeAccounts(
    requestedEntry.chargeLines,
    accountingEntity,
    deps.ledgerAccountRepo,
    repoOptions
  );
  const counterparties = await deps.counterpartyAppService.findOrCreateMany(
    requestedEntry.chargeLines.flatMap((line) =>
      line.counterparty ? [line.counterparty] : []
    ),
    accountingEntity.id,
    preparation.actor,
    getHeader(preparation).postedAt === null
      ? ECounterpartyStatus.Draft
      : ECounterpartyStatus.Active,
    repoOptions
  );
  const transferPayload: ICreateTransferEntryPayload = {
    header: getHeader(preparation),
    attachments: requestedEntry.attachments,
    sourceLine: transferHelpers.getSourceLinePayload(
      requestedEntry,
      sourceAccount
    ),
    destinationLines: [
      transferHelpers.getDestinationPayload(requestedEntry, destinationAccount),
      ...transferHelpers.transformChargeLineToJournalLine(
        requestedEntry,
        counterparties,
        chargeAccounts,
        deps.counterpartyAppService
      ),
    ],
  };
  const transferResult = await deps.journalEntryService.createTransfer(
    transferPayload,
    repoOptions
  );
  const requestedLineIds = [
    (requestedEntry.sourceLine.id as TEntityId | undefined) ?? null,
    (requestedEntry.destinationLine.id as TEntityId | undefined) ?? null,
    ...requestedEntry.chargeLines.map(
      (line) => (line.id as TEntityId | undefined) ?? null
    ),
  ];

  return {
    journalEntry: retainRequestedLineIds(
      transferResult.journalEntry[0],
      requestedLineIds
    ),
    counterparties,
    sourceAccount,
    destinationAssetAccount: transferResult.destinationAssetAccount,
  };
}

async function prepareSourceJournalEntry(
  deps: IDependencies,
  preparation: IJournalEntryRectificationPreparationPayload,
  repoOptions: IReadRepoOptions
): Promise<IPreparedSourceJournalEntry> {
  const { requestedEntry } = preparation;

  if (requestedEntry.sourceType === EJournalEntrySourceType.Payment) {
    return preparePayment(
      deps,
      { ...preparation, requestedEntry },
      repoOptions
    );
  }

  if (requestedEntry.sourceType === EJournalEntrySourceType.Receipt) {
    return prepareReceipt(
      deps,
      { ...preparation, requestedEntry },
      repoOptions
    );
  }

  if (requestedEntry.sourceType === EJournalEntrySourceType.Transfer) {
    return prepareTransfer(
      deps,
      { ...preparation, requestedEntry },
      repoOptions
    );
  }

  throw new appError.BadRequest({ sourceType: requestedEntry });
}

async function prepareCurrentFxEffects(
  deps: IDependencies,
  rectification: IJournalEntryRectificationResult,
  sourcePreparation: IPreparedSourceJournalEntry,
  actor: IJournalEntryRectificationPreparationPayload['actor'],
  repoOptions: IReadRepoOptions
): Promise<Omit<IPreparedFxRectification, 'fxReversal'>> {
  const { currentJournalEntry } = rectification;

  if (currentJournalEntry.sourceType === EJournalEntrySourceType.Payment) {
    const fxDisposition = await deps.fxLotAppService.dispose(
      {
        journalEntry: currentJournalEntry,
        account: sourcePreparation.sourceAccount,
        actor,
      },
      repoOptions
    );

    return { fxDisposition, fxAcquisition: null };
  }

  if (currentJournalEntry.sourceType === EJournalEntrySourceType.Receipt) {
    const fxAcquisition = await deps.fxLotAppService.acquire(
      {
        journalEntry: currentJournalEntry,
        account: sourcePreparation.destinationAssetAccount,
        actor,
      },
      repoOptions
    );

    return { fxDisposition: null, fxAcquisition };
  }

  if (currentJournalEntry.sourceType === EJournalEntrySourceType.Transfer) {
    const fxDisposition = await deps.fxLotAppService.dispose(
      {
        journalEntry: currentJournalEntry,
        account: sourcePreparation.sourceAccount,
        actor,
      },
      repoOptions
    );
    const fxAcquisition = await deps.fxLotAppService.acquire(
      {
        journalEntry: currentJournalEntry,
        account: sourcePreparation.destinationAssetAccount,
        actor,
      },
      repoOptions
    );

    return { fxDisposition, fxAcquisition };
  }

  throw new appError.BadRequest({ sourceType: currentJournalEntry.sourceType });
}

async function prepareFxRectification(
  deps: IDependencies,
  originalEntry: IJournalEntry,
  rectification: IJournalEntryRectificationResult,
  sourcePreparation: IPreparedSourceJournalEntry,
  actor: IJournalEntryRectificationPreparationPayload['actor'],
  repoOptions: IReadRepoOptions
): Promise<IPreparedFxRectification> {
  if (rectification.mode === EJournalEntryRectificationMode.VoidAndReplace) {
    const fxReversal = await deps.fxLotAppService.reverse(
      originalEntry.id,
      actor,
      repoOptions
    );
    const currentFxEffects = await prepareCurrentFxEffects(
      deps,
      rectification,
      sourcePreparation,
      actor,
      repoOptions
    );

    return { fxReversal, ...currentFxEffects };
  }

  const shouldPrepareCurrentFxEffects =
    rectification.mode === EJournalEntryRectificationMode.UpdateDraft &&
    rectification.currentJournalEntry.status === EJournalEntryStatus.Posted;

  if (shouldPrepareCurrentFxEffects) {
    const currentFxEffects = await prepareCurrentFxEffects(
      deps,
      rectification,
      sourcePreparation,
      actor,
      repoOptions
    );

    return { fxReversal: null, ...currentFxEffects };
  }

  return {
    fxReversal: null,
    fxDisposition: null,
    fxAcquisition: null,
  };
}

/**
 * Prepares the requested source-specific journal entry, applies the domain
 * rectification decision, and prepares any required FX reversal and corrected
 * effects. It performs no writes and propagates dependency failures.
 */
function makePrepare(
  deps: IDependencies
): IJournalEntryRectificationPreparationService['prepare'] {
  return async (preparation, repoOptions) => {
    const sourcePreparation = await prepareSourceJournalEntry(
      deps,
      preparation,
      repoOptions
    );
    const { createdBy: _creator, ...newEntry } = sourcePreparation.journalEntry;
    const rectification = await deps.journalEntryRectificationService.rectify(
      {
        actorId: preparation.actor,
        originalEntry: preparation.originalEntry,
        newEntry,
      },
      repoOptions
    );
    const fxRectification = await prepareFxRectification(
      deps,
      preparation.originalEntry,
      rectification,
      sourcePreparation,
      preparation.actor,
      repoOptions
    );

    return {
      rectification,
      counterparties: sourcePreparation.counterparties,
      ...fxRectification,
    };
  };
}

export default function makeJournalEntryRectificationPreparationService(
  deps: IDependencies
): IJournalEntryRectificationPreparationService {
  return Object.freeze({
    prepare: makePrepare(deps),
  });
}
