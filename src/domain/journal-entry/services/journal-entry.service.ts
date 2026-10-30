import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
import receiptEntryRule from '@domain/journal-entry/rules/receipt-entry.rule';
import getJournalEntryLinesHelper from '@domain/journal-entry/services/helpers/get-journal-entry-lines.helper';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import openingBalanceRevisionValidation from '@domain/journal-entry/services/validations/opening-balance-revision.validation';
import openingBalanceValidation from '@domain/journal-entry/services/validations/opening-balance.validation';
import {
  IJournalEntryHeaderPayload,
  IJournalEntryService,
} from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLineMakePayload,
} from '@domain/journal-entry/types/journal-line.types';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

/** Revalidates current payment participants and the effective posting period before preparing an audited, identity-preserving draft transition. */
function makePostDraftPayment(
  deps: IDependencies
): IJournalEntryService['postDraftPayment'] {
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

/** Revalidates current transfer participants and the effective posting period before preparing an audited, identity-preserving draft transition. */
function makePostDraftTransfer(
  deps: IDependencies
): IJournalEntryService['postDraftTransfer'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    const isDraftTransfer =
      entry.sourceType === EJournalEntrySourceType.Transfer &&
      entry.status === EJournalEntryStatus.Draft &&
      entry.postedAt === null;
    if (!isDraftTransfer) {
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

/**
 * Revalidates current receipt participants and the effective posting period before preparing an audited,
 * identity-preserving draft transition.
 */
function makePostDraftReceipt(
  deps: IDependencies
): IJournalEntryService['postDraftReceipt'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    const isDraftReceipt =
      entry.sourceType === EJournalEntrySourceType.Receipt &&
      entry.status === EJournalEntryStatus.Draft &&
      entry.postedAt === null;
    if (!isDraftReceipt) {
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

function makePostDraftOpeningBalance(
  deps: IDependencies
): IJournalEntryService['postDraftOpeningBalance'] {
  return async ({ entry, account, actor }, repoOptions) => {
    openingBalanceRevisionValidation.validateSourceType(entry);
    openingBalanceRevisionValidation.validateStatus(entry);
    openingBalanceRevisionValidation.validateAccountAssociation(entry, account);
    openingBalanceValidation.validateInitialDate(account, entry.effectiveDate);

    const counterpartIds = [
      ...new Set(
        entry.lines
          .filter((line) => line.accountId !== account.id)
          .map((line) => line.accountId)
      ),
    ];
    const counterparts = await deps.ledgerAccountRepo.findAllByIds(
      counterpartIds,
      entry.accountingEntityId,
      repoOptions
    );

    const journalLines = entry.lines.map((line) => {
      const lineAccount =
        line.accountId === account.id
          ? account
          : counterparts.find((candidate) => candidate.id === line.accountId);

      if (!lineAccount) {
        throw new journalEntryError.AccountNotFound({
          accountId: line.accountId,
        });
      }
      return { account: lineAccount, amount: line.amount };
    });

    journalEntryServiceValidation.validateAccountsAgainstRule(
      [account],
      counterparts,
      openingBalanceEntryRule
    );

    const postingDate = new Date();
    journalEntryServiceValidation.validateAccounts(
      {
        accountingEntityId: entry.accountingEntityId,
        effectiveDate: entry.effectiveDate,
        postedAt: postingDate,
      },
      journalLines
    );
    await deps.accountingPeriodService.validatePostingPeriod(
      entry.accountingEntityId,
      postingDate,
      repoOptions
    );

    return journalEntryEntity.update(
      entry,
      {
        id: entry.id,
        status: EJournalEntryStatus.Posted,
        postedAt: postingDate,
      },
      actor
    );
  };
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
    postDraftPayment: makePostDraftPayment(deps),
    postDraftReceipt: makePostDraftReceipt(deps),
    postDraftTransfer: makePostDraftTransfer(deps),
    postDraftOpeningBalance: makePostDraftOpeningBalance(deps),
    createReceipt: makeCreateReceipt(deps),

    createPayment: makeCreatePayment(deps),

    createTransfer: makeCreateTransfer(deps),
  };

  return Object.freeze(service);
}
