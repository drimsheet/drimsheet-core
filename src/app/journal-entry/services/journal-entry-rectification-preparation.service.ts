// TODO: check if this is truly needed or if it's a glorified helper
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import {
  IJournalEntryRectificationResult,
  IJournalEntryRectificationService,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntryHeaderPayload } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntryRectificationMode,
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  ICreatePaymentEntryPayload,
  IPaymentEntryService,
} from '@domain/journal-entry/types/payment-entry.service.types';
import {
  ICreateReceiptEntryPayload,
  IReceiptEntryService,
} from '@domain/journal-entry/types/receipt-entry.service.types';
import {
  ICreateTransferEntryPayload,
  ITransferEntryService,
} from '@domain/journal-entry/types/transfer-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import IFxCostBasisLotService, {
  IFxCostBasisAcquisitionResult,
  IFxCostBasisDispositionResult,
  IFxCostBasisReversalResult,
} from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import IJournalEntryRectificationPreparationAppService, {
  IJournalEntryRectificationPreparationPayload,
} from '@app/journal-entry/contracts/journal-entry-rectification-preparation.service.contract';
import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import getLedgerAccount from '@app/journal-entry/usecases/helpers/account-getter.helper';
import getCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-counterparties.helper';
import getTransferChargeAccountsHelper from '@app/journal-entry/usecases/helpers/get-transfer-charge-accounts.helper';
import getTransferDestinationLinePayloadHelper from '@app/journal-entry/usecases/helpers/get-transfer-destination-line-payload.helper';
import getTransferSourceLinePayloadHelper from '@app/journal-entry/usecases/helpers/get-transfer-source-line-payload.helper';
import transformTransferChargeLinesToJournalLinesHelper from '@app/journal-entry/usecases/helpers/transform-transfer-charge-lines-to-journal-lines.helper';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  counterpartyRepo: ICounterpartyRepo;
  paymentEntryService: IPaymentEntryService;
  receiptEntryService: IReceiptEntryService;
  transferEntryService: ITransferEntryService;
  journalEntryRectificationService: IJournalEntryRectificationService;
  ledgerAccountRepo: ILedgerAccountRepo;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
}

interface IPreparedSourceJournalEntry {
  journalEntry: IJournalEntry;
  sourceAccount: ILedgerAccount;
  destinationAssetAccount: ILedgerAccount;
}

interface IPreparedFxRectification {
  fxReversal: IFxCostBasisReversalResult | null;
  fxDisposition: IFxCostBasisDispositionResult | null;
  fxAcquisition: IFxCostBasisAcquisitionResult | null;
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
): IJournalEntryHeaderPayload {
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

  const counterparties = await getCounterpartiesHelper({
    ids: [
      requestedEntry.sourceLine.counterpartyId,
      ...requestedEntry.destinationLines.map((line) => line.counterpartyId),
    ],
    accountingEntityId: accountingEntity.id,
    repo: deps.counterpartyRepo,
    repoOptions,
  });
  const sourceCounterparty = counterparties.find(
    (candidate) => candidate.id === requestedEntry.sourceLine.counterpartyId
  )!;
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
      counterparty: counterparties.find(
        (candidate) => candidate.id === line.counterpartyId
      )!,
      sequenceOrder: line.sequenceOrder,
      amount: moneyMapper.fromDto(line.amount),
      exchangeRate: getExchangeRate(line.exchangeRate),
      description: line.description,
      meta: null,
    })),
  };
  const [journalEntry] = await deps.paymentEntryService.create(
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
  const counterparties = await getCounterpartiesHelper({
    ids: [
      ...requestedEntry.sourceLines.map((line) => line.counterpartyId),
      requestedEntry.destinationLine.counterpartyId,
    ],
    accountingEntityId: accountingEntity.id,
    repo: deps.counterpartyRepo,
    repoOptions,
  });
  const receiptPayload: ICreateReceiptEntryPayload = {
    header: getHeader(preparation),
    attachments: requestedEntry.attachments,
    sourceLines: requestedEntry.sourceLines.map((line, index) => ({
      account: sourceAccounts[index],
      counterparty: counterparties.find(
        (candidate) => candidate.id === line.counterpartyId
      )!,
      sequenceOrder: line.sequenceOrder,
      amount: moneyMapper.fromDto(line.amount),
      exchangeRate: getExchangeRate(line.exchangeRate),
      description: line.description,
      meta: null,
    })),
    destinationLine: {
      account: destinationAccount,
      counterparty: counterparties.find(
        (candidate) =>
          candidate.id === requestedEntry.destinationLine.counterpartyId
      )!,
      sequenceOrder: requestedEntry.destinationLine.sequenceOrder,
      amount: moneyMapper.fromDto(requestedEntry.destinationLine.amount),
      exchangeRate: getExchangeRate(
        requestedEntry.destinationLine.exchangeRate
      ),
      description: requestedEntry.destinationLine.description,
      meta: null,
    },
  };
  const [journalEntry] = await deps.receiptEntryService.create(
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
  const chargeAccounts = await getTransferChargeAccountsHelper(
    requestedEntry.chargeLines,
    accountingEntity,
    deps.ledgerAccountRepo,
    repoOptions
  );
  const counterparties = await getCounterpartiesHelper({
    ids: requestedEntry.chargeLines.map((line) => line.counterpartyId),
    accountingEntityId: accountingEntity.id,
    repo: deps.counterpartyRepo,
    repoOptions,
  });
  const transferPayload: ICreateTransferEntryPayload = {
    header: getHeader(preparation),
    attachments: requestedEntry.attachments,
    sourceLine: getTransferSourceLinePayloadHelper(
      requestedEntry,
      sourceAccount
    ),
    destinationLines: [
      getTransferDestinationLinePayloadHelper(
        requestedEntry,
        destinationAccount
      ),
      ...transformTransferChargeLinesToJournalLinesHelper(
        requestedEntry,
        counterparties,
        chargeAccounts
      ),
    ],
  };
  const transferResult = await deps.transferEntryService.create(
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
  const { sourceType } = currentJournalEntry;
  const hasDisposition =
    sourceType === EJournalEntrySourceType.Payment ||
    sourceType === EJournalEntrySourceType.Transfer;
  const hasAcquisition =
    sourceType === EJournalEntrySourceType.Receipt ||
    sourceType === EJournalEntrySourceType.Transfer;
  const isUnsupportedSource = !hasDisposition && !hasAcquisition;

  if (isUnsupportedSource) {
    throw new appError.BadRequest({ sourceType });
  }

  if (currentJournalEntry.status === EJournalEntryStatus.Draft) {
    return { fxDisposition: null, fxAcquisition: null };
  }

  const { sourceAccount, destinationAssetAccount } = sourcePreparation;
  const fxDisposition = hasDisposition
    ? await deps.fxCostBasisLotService.dispose(
        {
          journalEntry: currentJournalEntry,
          account: sourceAccount,
          createdBy: actor,
          officialRate: await resolveOfficialRateHelper(
            deps.exchangeRateAppService,
            currentJournalEntry.lines,
            sourceAccount.id,
            repoOptions
          ),
        },
        repoOptions
      )
    : null;
  const fxAcquisition = hasAcquisition
    ? deps.fxCostBasisLotService.acquire({
        journalEntry: currentJournalEntry,
        account: destinationAssetAccount,
        createdBy: actor,
        officialRate: await resolveOfficialRateHelper(
          deps.exchangeRateAppService,
          currentJournalEntry.lines,
          destinationAssetAccount.id,
          repoOptions
        ),
      })
    : null;

  return { fxDisposition, fxAcquisition };
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
    const fxReversal = await deps.fxCostBasisLotService.reverse(
      originalEntry.id,
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
): IJournalEntryRectificationPreparationAppService['prepare'] {
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
      ...fxRectification,
    };
  };
}

export default function makeJournalEntryRectificationPreparationAppService(
  deps: IDependencies
): IJournalEntryRectificationPreparationAppService {
  return Object.freeze({
    prepare: makePrepare(deps),
  });
}
