import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
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
import { IPaymentEntryService } from '@domain/journal-entry/types/payment-entry.service.types';
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
 * Validates payment rules and builds an audited draft or posted journal entry.
 * A posted FX payment checks its source account balance before construction.
 */
function makeCreate(deps: IDependencies): IPaymentEntryService['create'] {
  return async (payload, repoOptions) => {
    const { header, sourceLine, destinationLines, attachments } = payload;
    const journalLines = [sourceLine, ...destinationLines];

    journalEntryServiceValidation.validateAccountsAgainstRule(
      [sourceLine.account],
      destinationLines.map((line) => line.account),
      paymentEntryRule
    );

    journalEntryServiceValidation.validateAccounts(header, journalLines);

    // Prevent overdrafts on posted FX payments by checking the ledger balance
    // in the source currency before the separate cost-basis lot allocation.
    const sourceAccountCurrencyCode = sourceLine.account.currency?.code ?? null;
    const isForexSourceAccount =
      sourceAccountCurrencyCode !== null &&
      sourceAccountCurrencyCode !== header.functionalCurrencyCode;
    const isPosting = header.postedAt !== null;
    const shouldValidateSourceBalance = isPosting && isForexSourceAccount;

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

    if (isPosting) {
      await deps.accountingPeriodService.validatePostingPeriod(
        header.accountingEntityId,
        header.effectiveDate,
        repoOptions
      );
    }

    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    const functionalCurrency = currencyEntity.getByCode(
      header.functionalCurrencyCode
    );

    const sourceLinePayload: IJournalLineMakePayload = {
      accountId: sourceLine.account.id,
      counterpartyId: sourceLine.counterparty?.id,
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

    return journalEntryEntity.make({
      accountingEntityId: header.accountingEntityId,
      sourceType: EJournalEntrySourceType.Payment,
      effectiveDate: header.effectiveDate,
      postedAt: header.postedAt,
      memo: header.memo,
      createdBy: header.createdBy,
      functionalCurrency,
      attachments,
      lines: [sourceLinePayload, ...destinationLinePayloads],
    });
  };
}

/** Resolves payment participants and validates requested financial edits. */
function makeUpdateDraft(
  deps: IDependencies
): IPaymentEntryService['updateDraft'] {
  return async (
    {
      entry,
      actor,
      attachments,
      effectiveDate,
      memo,
      sourceLine,
      destinationLines,
    },
    repoOptions
  ) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Payment
    );

    const headerUpdate = { id: entry.id, attachments, effectiveDate, memo };
    const hasFinancialEdits =
      sourceLine !== undefined ||
      destinationLines !== undefined ||
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

    const originalSource = sourceLines[0];
    const hasInvalidSourceId =
      sourceLine?.id !== undefined && sourceLine.id !== originalSource.id;
    if (hasInvalidSourceId) {
      throw new journalEntryError.RectificationLineId({ id: sourceLine.id });
    }
    const source = sourceLine
      ? patchDraftJournalLineHelper(originalSource, sourceLine)
      : originalSource;

    const originalDestinations = entry.lines.filter(
      (line) => line.side === EJournalSide.Debit
    );
    const destinations = destinationLines
      ? replaceDraftJournalLinesHelper({
          originalLines: originalDestinations,
          requestedLines: destinationLines,
          header: {
            id: entry.id,
            createdBy: actor,
            createdAt: new Date(),
            memo: memo === undefined ? entry.memo : memo,
          },
          functionalCurrency: originalSource.functionalAmount.currency,
          side: EJournalSide.Debit,
        })
      : originalDestinations;

    const lines = [source, ...destinations];
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
    const [resolvedSource, ...resolvedDestinations] = journalLines;
    const header = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate,
      postedAt: null,
    };

    journalEntryServiceValidation.validateAccountsAgainstRule(
      [resolvedSource.account],
      resolvedDestinations.map((line) => line.account),
      paymentEntryRule
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
 * Revalidates payment participants, FX funds, and the effective posting period
 * before preparing an audited transition that preserves the draft's identity.
 */
function makePostDraft(deps: IDependencies): IPaymentEntryService['postDraft'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    journalEntryServiceValidation.validateDraftEntry(
      entry,
      EJournalEntrySourceType.Payment
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

    journalEntryServiceValidation.validateAccountsAgainstRule(
      [sourceLine.account],
      destinationLines.map((line) => line.account),
      paymentEntryRule
    );
    journalEntryServiceValidation.validateAccounts(header, journalLines);
    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    // Prevent overdrafts on posted FX payments by checking the ledger balance
    // in the source currency before the separate cost-basis lot allocation.
    const sourceCurrencyCode = sourceLine.account.currency?.code ?? null;
    const isForexSourceAccount =
      sourceCurrencyCode !== null &&
      sourceCurrencyCode !== header.functionalCurrencyCode;

    if (isForexSourceAccount) {
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
    }

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
    };
  };
}

/** Prepares a reversal, links it to the void, and validates the replacement. */
function makeVoidAndReplace(
  deps: IDependencies
): IPaymentEntryService['voidAndReplace'] {
  const create = makeCreate(deps);

  return async (existing, replacementPayload, repoOptions) => {
    if (existing.sourceType !== EJournalEntrySourceType.Payment) {
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

export default function makePaymentEntryService(
  deps: IDependencies
): IPaymentEntryService {
  const service: IPaymentEntryService = {
    create: makeCreate(deps),
    updateDraft: makeUpdateDraft(deps),
    postDraft: makePostDraft(deps),
    voidAndReplace: makeVoidAndReplace(deps),
  };

  return Object.freeze(service);
}
