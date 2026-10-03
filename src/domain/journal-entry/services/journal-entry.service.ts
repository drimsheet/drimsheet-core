import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
import dateUtils from '@shared/utils/date';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSide from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
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
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import moneyValue from '@domain/money/values/money.vo';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Prepares the common journal after the caller-specific opening-date guard. */
async function prepareOpeningBalance(
  deps: IDependencies,
  payload: Parameters<IJournalEntryService['createOpeningBalance']>[0],
  repoOptions: IReadRepoOptions
) {
  const {
    accountingEntityId,
    account,
    functionalCurrencyCode,
    amount,
    effectiveDate,
    exchangeRate,
    createdBy,
  } = payload;

  const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);

  const functionalAmount = exchangeRate
    ? moneyValue.convert(amount, exchangeRate, functionalCurrency)
    : amount;

  if (account.isControlAccount) {
    throw new journalEntryError.ControlAccountOpeningBalanceNotAllowed({
      accountId: account.id,
    });
  }

  const [existingBalanceAdjustment] =
    await deps.ledgerAccountBalanceRepo.findAdjustmentsByAccountId(
      account.id,
      repoOptions
    );

  if (existingBalanceAdjustment) {
    throw new journalEntryError.ExistingOpeningBalance({
      accountId: account.id,
    });
  }

  const [equityAccount] = await deps.ledgerAccountRepo.findBySubType(
    accountingEntityId,
    ELedgerType.Equity,
    EEquitySubType.OpeningBalance,
    repoOptions
  );

  if (!equityAccount) {
    throw new journalEntryError.UnConfiguredOpeningBalanceAccount();
  }

  journalEntryServiceValidation.validateAccountsAgainstRule(
    [account],
    [equityAccount],
    openingBalanceEntryRule
  );

  const postedAt =
    account.status === ELedgerAccountStatus.Draft ? null : effectiveDate;
  const headerValidationPayload = {
    accountingEntityId,
    effectiveDate,
    postedAt,
  };
  const accountValidationPayload = {
    account,
    amount,
  };
  const equityValidationPayload = {
    account: equityAccount,
    amount: functionalAmount,
  };
  journalEntryServiceValidation.validateAccounts(headerValidationPayload, [
    accountValidationPayload,
    equityValidationPayload,
  ]);

  const accountSide: IJournalLineMakePayload = {
    accountId: account.id,
    counterpartyId: null,
    functionalCurrency,
    amount,
    exchangeRate,
    sequenceOrder: 1,
    side: account.normalBalance,
    description: 'Opening balance',
  };

  const equitySide: IJournalLineMakePayload = {
    accountId: equityAccount.id,
    counterpartyId: null,
    functionalCurrency,
    amount: functionalAmount,
    exchangeRate: null,
    sequenceOrder: 2,
    description: null,
    side: getOppositeJournalSide(account.normalBalance),
  };

  return journalEntryEntity.make({
    accountingEntityId,
    sourceType: EJournalEntrySourceType.OpeningBalance,
    effectiveDate,
    postedAt,
    memo: 'Opening balance',
    createdBy,
    functionalCurrency,
    lines: [accountSide, equitySide],
  });
}

/** Rejects repeat opening balances and prepares a journal for the existing-account workflow. */
function makeCreateOpeningBalance(
  deps: IDependencies
): IJournalEntryService['createOpeningBalance'] {
  return async (payload, repoOptions) => {
    if (payload.account.openingBalanceDate !== null)
      throw new journalEntryError.ExistingOpeningBalance({
        accountId: payload.account.id,
      });
    return prepareOpeningBalance(deps, payload, repoOptions);
  };
}

/** Accepts only an unpersisted account with its initial date; never bypasses the existing-account guard. */
function makeCreateInitialOpeningBalance(
  deps: IDependencies
): IJournalEntryService['createInitialOpeningBalance'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new journalEntryError.InitialOpeningBalanceTransactionRequired();
    const { account } = payload;
    const hasMatchingDate =
      account.openingBalanceDate !== null &&
      dateUtils.isSameDay(account.openingBalanceDate, payload.effectiveDate);
    if (!hasMatchingDate)
      throw new journalEntryError.InvalidOpeningBalanceDate({
        accountId: account.id,
      });
    const existing = await deps.ledgerAccountRepo.findById(
      account.id,
      account.accountingEntityId,
      repoOptions
    );
    if (existing)
      throw new journalEntryError.InitialOpeningBalanceAccountAlreadyExists({
        accountId: account.id,
      });

    // Keep the posting period open until the caller inserts and commits this journal.
    await deps.accountingPeriodService.validatePostingPeriod(
      payload.accountingEntityId,
      payload.effectiveDate,
      { ...repoOptions, lock: ERepoLock.Share }
    );

    return prepareOpeningBalance(deps, payload, repoOptions);
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
    createOpeningBalance: makeCreateOpeningBalance(deps),
    createInitialOpeningBalance: makeCreateInitialOpeningBalance(deps),

    createReceipt: makeCreateReceipt(deps),

    createPayment: makeCreatePayment(deps),

    createTransfer: makeCreateTransfer(deps),
  };

  return Object.freeze(service);
}
