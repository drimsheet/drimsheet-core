import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
import getJournalEntryLinesHelper from '@domain/journal-entry/services/helpers/get-journal-entry-lines.helper';
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
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
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

    const sourceAccountCurrencyCode = sourceLine.account.currency?.code ?? null;
    const isForexSourceAccount =
      sourceAccountCurrencyCode !== null &&
      sourceAccountCurrencyCode !== header.functionalCurrencyCode;
    const shouldValidateSourceBalance =
      header.postedAt !== null && isForexSourceAccount;

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

/**
 * Revalidates payment participants, FX funds, and the effective posting period
 * before preparing an audited transition that preserves the draft's identity.
 */
function makePostDraft(deps: IDependencies): IPaymentEntryService['postDraft'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    const isDraftPayment =
      entry.sourceType === EJournalEntrySourceType.Payment &&
      entry.status === EJournalEntryStatus.Draft &&
      entry.postedAt === null;
    if (!isDraftPayment) {
      throw new journalEntryError.RectificationNotPermitted({
        journalEntryId: entry.id,
        sourceType: entry.sourceType,
        status: entry.status,
      });
    }

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

export default function makePaymentEntryService(
  deps: IDependencies
): IPaymentEntryService {
  const service: IPaymentEntryService = {
    create: makeCreate(deps),
    postDraft: makePostDraft(deps),
  };

  return Object.freeze(service);
}
