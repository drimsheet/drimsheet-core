import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import getJournalEntryLinesHelper from '@domain/journal-entry/services/helpers/get-journal-entry-lines.helper';
import patchDraftJournalLineHelper from '@domain/journal-entry/services/helpers/patch-draft-journal-line.helper';
import replaceDraftJournalLinesHelper from '@domain/journal-entry/services/helpers/replace-draft-journal-lines.helper';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import { IJournalEntryHeaderPayload } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLineMakePayload,
} from '@domain/journal-entry/types/journal-line.types';
import { ITransferEntryService } from '@domain/journal-entry/types/transfer-entry.service.types';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  counterpartyRepo: ICounterpartyRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
}

/**
 * Builds an audited transfer with its destination asset account. Checks the
 * source balance when the transfer is created as posted.
 */
function makeCreate(deps: IDependencies): ITransferEntryService['create'] {
  return async (payload, repoOptions) => {
    const { header, sourceLine, destinationLines, attachments } = payload;
    const journalLines = [sourceLine, ...destinationLines];

    journalEntryServiceValidation.validateTransferAccountComposition(
      sourceLine.account,
      destinationLines
    );

    const destinationAssetAccount = destinationLines.find((line) =>
      journalEntryServiceValidation.isTransferAssetAccount(line.account)
    )!.account;

    journalEntryServiceValidation.validateAccounts(header, journalLines);

    const shouldValidateSourceBalance = header.postedAt !== null;

    if (shouldValidateSourceBalance) {
      const sourceAccountBalance =
        await deps.ledgerAccountBalanceRepo.findByAccountId(
          sourceLine.account.id,
          header.accountingEntityId,
          repoOptions
        );
      journalEntryServiceValidation.validateSourceAccountBalance(
        sourceLine.account.id,
        sourceLine.amount,
        sourceAccountBalance
      );
    }

    await deps.accountingPeriodService.validatePostingPeriod(
      header.accountingEntityId,
      header.effectiveDate,
      repoOptions
    );

    journalEntryServiceValidation.validateCounterparties(
      header,
      destinationLines
    );

    const functionalCurrency = currencyEntity.getByCode(
      header.functionalCurrencyCode
    );
    const sourceLinePayload: IJournalLineMakePayload = {
      accountId: sourceLine.account.id,
      counterpartyId: null,
      sequenceOrder: sourceLine.sequenceOrder,
      amount: sourceLine.amount,
      exchangeRate: sourceLine.exchangeRate,
      side: EJournalSide.Credit,
      description: sourceLine.description,
      functionalCurrency,
    };
    const destinationLinePayloads: IJournalLineMakePayload[] =
      destinationLines.map((line) => ({
        accountId: line.account.id,
        counterpartyId: line.counterparty?.id,
        sequenceOrder: line.sequenceOrder,
        amount: line.amount,
        exchangeRate: line.exchangeRate,
        description: line.description,
        functionalCurrency,
        side: EJournalSide.Debit,
      }));

    const journalEntry = journalEntryEntity.make({
      accountingEntityId: header.accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: header.effectiveDate,
      postedAt: header.postedAt,
      memo: header.memo,
      createdBy: header.createdBy,
      functionalCurrency,
      attachments,
      lines: [sourceLinePayload, ...destinationLinePayloads],
    });

    return { journalEntry, destinationAssetAccount };
  };
}

/** Resolves transfer participants and validates requested financial edits. */
function makeUpdateDraft(
  deps: IDependencies
): ITransferEntryService['updateDraft'] {
  return async (
    {
      entry,
      actor,
      attachments,
      effectiveDate,
      memo,
      sourceLine,
      destinationLine,
      chargeLines,
    },
    repoOptions
  ) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Transfer
    );

    const headerUpdate = { id: entry.id, attachments, effectiveDate, memo };
    const hasFinancialEdits =
      sourceLine !== undefined ||
      destinationLine !== undefined ||
      chargeLines !== undefined ||
      effectiveDate !== undefined;
    if (!hasFinancialEdits) {
      return journalEntryEntity.update(entry, headerUpdate, actor);
    }

    const sourceLines = entry.lines.filter(
      (line) => line.side === EJournalSide.Credit
    );
    if (sourceLines.length !== 1) {
      throw new journalEntryError.InvalidSourceType({
        journalEntryId: entry.id,
      });
    }

    const accountIds = new Set(entry.lines.map((line) => line.accountId));
    for (const line of [sourceLine, destinationLine, ...(chargeLines ?? [])]) {
      if (line?.accountId !== undefined) {
        accountIds.add(line.accountId);
      }
    }

    // The original debit accounts identify the destination asset among charges.
    const accounts = await deps.ledgerAccountRepo.findAllByIds(
      [...accountIds],
      entry.accountingEntityId,
      repoOptions
    );
    const assetAccountIds = new Set(
      accounts
        .filter(journalEntryServiceValidation.isTransferAssetAccount)
        .map((account) => account.id)
    );
    const debitLines = entry.lines.filter(
      (line) => line.side === EJournalSide.Debit
    );
    const destinationAssetLines = debitLines.filter((line) =>
      assetAccountIds.has(line.accountId)
    );
    if (destinationAssetLines.length !== 1) {
      throw new journalEntryError.InvalidDestinationAccount({
        journalEntryId: entry.id,
      });
    }

    const originalSource = sourceLines[0];
    const originalDestination = destinationAssetLines[0];
    const hasInvalidSourceId =
      sourceLine?.id !== undefined && sourceLine.id !== originalSource.id;
    if (hasInvalidSourceId) {
      throw new journalEntryError.RectificationLineId({ id: sourceLine.id });
    }
    const hasInvalidDestinationId =
      destinationLine?.id !== undefined &&
      destinationLine.id !== originalDestination.id;
    if (hasInvalidDestinationId) {
      throw new journalEntryError.RectificationLineId({
        id: destinationLine.id,
      });
    }

    const source = sourceLine
      ? patchDraftJournalLineHelper(originalSource, sourceLine)
      : originalSource;
    const destination = destinationLine
      ? patchDraftJournalLineHelper(originalDestination, destinationLine)
      : originalDestination;
    const originalCharges = debitLines.filter(
      (line) => line.id !== originalDestination.id
    );
    const charges = chargeLines
      ? replaceDraftJournalLinesHelper({
          originalLines: originalCharges,
          requestedLines: chargeLines,
          header: {
            id: entry.id,
            createdBy: actor,
            createdAt: new Date(),
            memo: memo === undefined ? entry.memo : memo,
          },
          functionalCurrency: originalSource.functionalAmount.currency,
          side: EJournalSide.Debit,
        })
      : originalCharges;

    const lines = [source, destination, ...charges];
    const counterpartyIds = [
      ...new Set(
        lines.map((line) => line.counterpartyId).filter((id) => id !== null)
      ),
    ];

    const counterparties = await deps.counterpartyRepo.findByIds(
      counterpartyIds,
      entry.accountingEntityId,
      repoOptions
    );
    const journalLines = getJournalEntryLinesHelper(
      lines,
      accounts,
      counterparties
    );
    const [resolvedSource, resolvedDestination, ...resolvedCharges] =
      journalLines;
    if (
      !journalEntryServiceValidation.isTransferAssetAccount(
        resolvedDestination.account
      )
    ) {
      throw new journalEntryError.InvalidDestinationAccount({
        accountId: resolvedDestination.account.id,
      });
    }

    journalEntryServiceValidation.validateTransferAccountComposition(
      resolvedSource.account,
      [resolvedDestination, ...resolvedCharges]
    );
    const header = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate,
      postedAt: null,
    };
    journalEntryServiceValidation.validateAccounts(header, journalLines);
    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    // Sequence order is stored on each line. Keep the array stable on a no-op.
    const storedOrder = new Map(
      entry.lines.map((line, index) => [line.id, index])
    );
    lines.sort(
      (left, right) =>
        (storedOrder.get(left.id) ?? entry.lines.length) -
        (storedOrder.get(right.id) ?? entry.lines.length)
    );

    return journalEntryEntity.update(entry, { ...headerUpdate, lines }, actor);
  };
}

/**
 * Revalidates current transfer participants and the effective posting period
 * before preparing an audited posting that preserves the draft's identity.
 */
function makePostDraft(
  deps: IDependencies
): ITransferEntryService['postDraft'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Transfer
    );

    const journalLines = getJournalEntryLinesHelper(
      entry.lines,
      accounts,
      counterparties
    );
    const sourceLines = journalLines.filter(
      (line) => line.side === EJournalSide.Credit
    );
    const destinationLines = journalLines.filter(
      (line) => line.side === EJournalSide.Debit
    );
    if (sourceLines.length !== 1) {
      throw new journalEntryError.InvalidSourceType({
        journalEntryId: entry.id,
      });
    }
    const sourceLine = sourceLines[0];
    const postingDate = new Date();
    const header: IJournalEntryHeaderPayload = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate: entry.effectiveDate,
      postedAt: postingDate,
      memo: entry.memo,
      createdBy: entry.createdBy,
      functionalCurrencyCode: sourceLine.functionalAmount.currency.code,
    };

    journalEntryServiceValidation.validateTransferAccountComposition(
      sourceLine.account,
      destinationLines
    );
    const destinationAssetAccount = destinationLines.find((line) =>
      journalEntryServiceValidation.isTransferAssetAccount(line.account)
    )!.account;
    journalEntryServiceValidation.validateAccounts(header, journalLines);
    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    const sourceBalance = await deps.ledgerAccountBalanceRepo.findByAccountId(
      sourceLine.account.id,
      entry.accountingEntityId,
      repoOptions
    );
    journalEntryServiceValidation.validateSourceAccountBalance(
      sourceLine.account.id,
      sourceLine.amount,
      sourceBalance
    );

    await deps.accountingPeriodService.validatePostingPeriod(
      entry.accountingEntityId,
      entry.effectiveDate,
      repoOptions
    );

    const entryUpdateInput = {
      id: entry.id,
      status: EJournalEntryStatus.Posted,
      postedAt: postingDate,
    };

    const updatedEntry = journalEntryEntity.update(
      entry,
      entryUpdateInput,
      actor
    );

    return {
      journalEntry: updatedEntry,
      sourceAccount: sourceLine.account,
      destinationAssetAccount,
    };
  };
}

/** Prepares a reversal, links it to the void, and validates the replacement. */
function makeVoidAndReplace(
  deps: IDependencies
): ITransferEntryService['voidAndReplace'] {
  const create = makeCreate(deps);

  return async (existing, replacementPayload, repoOptions) => {
    if (existing.sourceType !== EJournalEntrySourceType.Transfer) {
      throw new journalEntryError.RectificationNotPermitted({
        journalEntryId: existing.id,
        sourceType: existing.sourceType,
      });
    }

    const reversalDate = existing.effectiveDate;
    const postedAt = new Date();
    const functionalCurrency = existing.lines[0].functionalAmount.currency;
    const reversal = journalEntryEntity.make({
      accountingEntityId: existing.accountingEntityId,
      sourceType: EJournalEntrySourceType.Reversal,
      effectiveDate: reversalDate,
      postedAt,
      memo: null,
      createdBy: replacementPayload.header.createdBy,
      functionalCurrency,
      lines: existing.lines.map((line) => ({
        accountId: line.accountId,
        counterpartyId: line.counterpartyId,
        sequenceOrder: line.sequenceOrder,
        amount: line.amount,
        exchangeRate: line.exchangeRate,
        side: getOppositeJournalSideHelper(line.side),
        description: line.description,
        functionalCurrency,
      })),
    });
    const [reversingEntry] = reversal;
    const voided = journalEntryEntity.void(existing, {
      voidingEntryId: reversingEntry.id,
    });
    const [, , audit] = voided;

    if (audit === null) {
      return { voided, reversal: null, replacement: null };
    }

    const accountIds = [
      ...new Set(existing.lines.map((line) => line.accountId)),
    ];
    const accounts = await deps.ledgerAccountRepo.findAllByIds(
      accountIds,
      existing.accountingEntityId,
      repoOptions
    );
    journalEntryServiceValidation.validateArchivedAccounts(accounts);

    await deps.accountingPeriodService.validatePostingPeriod(
      existing.accountingEntityId,
      reversalDate,
      repoOptions
    );
    const replacement = await create(replacementPayload, repoOptions);

    return { voided, reversal, replacement };
  };
}

export default function makeTransferEntryService(
  deps: IDependencies
): ITransferEntryService {
  const service: ITransferEntryService = {
    create: makeCreate(deps),
    updateDraft: makeUpdateDraft(deps),
    postDraft: makePostDraft(deps),
    voidAndReplace: makeVoidAndReplace(deps),
  };

  return Object.freeze(service);
}
