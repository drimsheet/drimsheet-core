import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
import receiptEntryRule from '@domain/journal-entry/rules/receipt-entry.rule';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLineMakePayload,
} from '@domain/journal-entry/types/journal-line.types';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

function makeCreateReceipt(
  deps: IDependencies
): IJournalEntryService['createReceipt'] {
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

function makeCreatePayment(
  deps: IDependencies
): IJournalEntryService['createPayment'] {
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

function makeCreateTransfer(
  deps: IDependencies
): IJournalEntryService['createTransfer'] {
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

    if (sourceLine.account.id === destinationAssetAccount.id) {
      throw new journalEntryError.DuplicateAccountsNotPermitted({
        accountIds: [sourceLine.account.id, destinationAssetAccount.id],
      });
    }

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

export default function makeJournalEntryService(deps: IDependencies) {
  const service: IJournalEntryService = {
    createReceipt: makeCreateReceipt(deps),

    createPayment: makeCreatePayment(deps),

    createTransfer: makeCreateTransfer(deps),
  };

  return Object.freeze(service);
}
