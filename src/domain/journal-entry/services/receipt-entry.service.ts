import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import receiptEntryRule from '@domain/journal-entry/rules/receipt-entry.rule';
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
import { IReceiptEntryService } from '@domain/journal-entry/types/receipt-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  counterpartyRepo: ICounterpartyRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Builds an audited receipt after validating its accounts and posting period. */
function makeCreate(deps: IDependencies): IReceiptEntryService['create'] {
  return async (payload, repoOptions) => {
    const { header, sourceLines, destinationLine, attachments } = payload;
    const journalLines = [...sourceLines, destinationLine];

    const sourceLineAccounts = sourceLines.map((line) => line.account);

    // validate receipt rule
    journalEntryServiceValidation.validateAccountsAgainstRule(
      sourceLineAccounts,
      [destinationLine.account],
      receiptEntryRule
    );

    journalEntryServiceValidation.validateAccounts(header, journalLines);

    await deps.accountingPeriodService.validatePostingPeriod(
      header.accountingEntityId,
      header.effectiveDate,
      repoOptions
    );

    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    const functionalCurrency = currencyEntity.getByCode(
      header.functionalCurrencyCode
    );

    const sourceLinesPayload: IJournalLineMakePayload[] = sourceLines.map(
      (line) => ({
        accountId: line.account.id,
        counterpartyId: line.counterparty?.id,
        sequenceOrder: line.sequenceOrder,
        amount: line.amount,
        exchangeRate: line.exchangeRate,
        side: EJournalSide.Credit,
        description: line.description,
        functionalCurrency,
      })
    );
    const destinationLinePayload: IJournalLineMakePayload = {
      accountId: destinationLine.account.id,
      counterpartyId: destinationLine.counterparty?.id,
      sequenceOrder: destinationLine.sequenceOrder,
      amount: destinationLine.amount,
      exchangeRate: destinationLine.exchangeRate,
      description: destinationLine.description,
      functionalCurrency,
      side: EJournalSide.Debit,
    };

    return journalEntryEntity.make({
      accountingEntityId: header.accountingEntityId,
      sourceType: EJournalEntrySourceType.Receipt,
      effectiveDate: header.effectiveDate,
      postedAt: header.postedAt,
      memo: header.memo,
      createdBy: header.createdBy,
      functionalCurrency,
      attachments,
      lines: [...sourceLinesPayload, destinationLinePayload],
    });
  };
}

/** Resolves receipt participants and validates requested financial edits. */
function makeUpdateDraft(
  deps: IDependencies
): IReceiptEntryService['updateDraft'] {
  return async (
    {
      entry,
      actor,
      attachments,
      effectiveDate,
      memo,
      sourceLines,
      destinationLine,
    },
    repoOptions
  ) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Receipt
    );

    const headerUpdate = { id: entry.id, attachments, effectiveDate, memo };
    const hasFinancialEdits =
      sourceLines !== undefined ||
      destinationLine !== undefined ||
      effectiveDate !== undefined;
    if (!hasFinancialEdits) {
      return journalEntryEntity.update(entry, headerUpdate, actor);
    }

    const destinationLines = entry.lines.filter(
      (line) => line.side === EJournalSide.Debit
    );
    if (destinationLines.length !== 1) {
      throw new journalEntryError.InvalidDestinationAccount({
        journalEntryId: entry.id,
      });
    }

    const originalDestination = destinationLines[0];
    const hasInvalidDestinationId =
      destinationLine?.id !== undefined &&
      destinationLine.id !== originalDestination.id;
    if (hasInvalidDestinationId) {
      throw new journalEntryError.RectificationLineId({
        id: destinationLine.id,
      });
    }
    const destination = destinationLine
      ? patchDraftJournalLineHelper(originalDestination, destinationLine)
      : originalDestination;

    const originalSources = entry.lines.filter(
      (line) => line.side === EJournalSide.Credit
    );
    const sources = sourceLines
      ? replaceDraftJournalLinesHelper({
          originalLines: originalSources,
          requestedLines: sourceLines,
          header: {
            id: entry.id,
            createdBy: actor,
            createdAt: new Date(),
            memo: memo === undefined ? entry.memo : memo,
          },
          functionalCurrency: originalDestination.functionalAmount.currency,
          side: EJournalSide.Credit,
        })
      : originalSources;

    const lines = [destination, ...sources];
    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const counterpartyIds = [
      ...new Set(
        lines.map((line) => line.counterpartyId).filter((id) => id !== null)
      ),
    ];

    const accounts = await deps.ledgerAccountRepo.findAllByIds(
      accountIds,
      entry.accountingEntityId,
      repoOptions
    );
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
    const [resolvedDestination, ...resolvedSources] = journalLines;
    const header = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate,
      postedAt: null,
    };

    journalEntryServiceValidation.validateAccountsAgainstRule(
      resolvedSources.map((line) => line.account),
      [resolvedDestination.account],
      receiptEntryRule
    );
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
 * Revalidates current receipt participants and the effective posting period
 * before preparing an audited posting that preserves the draft's identity.
 */
function makePostDraft(deps: IDependencies): IReceiptEntryService['postDraft'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Receipt
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
    if (destinationLines.length !== 1) {
      throw new journalEntryError.InvalidDestinationAccount({
        journalEntryId: entry.id,
      });
    }
    const destinationLine = destinationLines[0];
    const postingDate = new Date();
    const header: IJournalEntryHeaderPayload = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate: entry.effectiveDate,
      postedAt: postingDate,
      memo: entry.memo,
      createdBy: entry.createdBy,
      functionalCurrencyCode: destinationLine.functionalAmount.currency.code,
    };

    journalEntryServiceValidation.validateAccountsAgainstRule(
      sourceLines.map((line) => line.account),
      [destinationLine.account],
      receiptEntryRule
    );
    journalEntryServiceValidation.validateAccounts(header, journalLines);
    journalEntryServiceValidation.validateCounterparties(header, journalLines);

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
      destinationAccount: destinationLine.account,
    };
  };
}

/** Prepares a reversal, links it to the void, and validates the replacement. */
function makeVoidAndReplace(
  deps: IDependencies
): IReceiptEntryService['voidAndReplace'] {
  const create = makeCreate(deps);

  return async (existing, replacementPayload, repoOptions) => {
    if (existing.sourceType !== EJournalEntrySourceType.Receipt) {
      throw new journalEntryError.RectificationNotPermitted({
        journalEntryId: existing.id,
        sourceType: existing.sourceType,
      });
    }

    const reversalDate = new Date();
    const functionalCurrency = existing.lines[0].functionalAmount.currency;
    const reversal = journalEntryEntity.make({
      accountingEntityId: existing.accountingEntityId,
      sourceType: EJournalEntrySourceType.Reversal,
      effectiveDate: reversalDate,
      postedAt: reversalDate,
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

export default function makeReceiptEntryService(
  deps: IDependencies
): IReceiptEntryService {
  const service: IReceiptEntryService = {
    create: makeCreate(deps),
    updateDraft: makeUpdateDraft(deps),
    postDraft: makePostDraft(deps),
    voidAndReplace: makeVoidAndReplace(deps),
  };

  return Object.freeze(service);
}
