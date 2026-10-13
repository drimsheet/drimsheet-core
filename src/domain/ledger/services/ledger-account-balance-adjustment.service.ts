import { TEntityId } from '@shared/types/uuid';

import ledgerBalanceEffectRule from '@domain/accounting/rules/ledger-balance-effect.rule';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import ILedgerAccountBalanceAdjustmentService, {
  ILedgerAccountBalanceDelta,
} from '@domain/ledger/types/ledger-account-balance-adjustment.service.types';
import { ELedgerAccountBalanceEffect } from '@domain/ledger/types/ledger-account-balance.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

function groupLinesByAccount(journalEntry: IJournalEntry) {
  const accountLines = new Map<TEntityId, IJournalLine[]>();

  for (const line of journalEntry.lines) {
    const lines = accountLines.get(line.accountId) ?? [];
    lines.push(line);
    accountLines.set(line.accountId, lines);
  }

  return accountLines;
}

function validateLines(lines: IJournalLine[], account: ILedgerAccount) {
  const prototype = lines[0];
  const valid = lines.every(
    (line) =>
      line.accountId === account.id &&
      line.functionalAmount.currency.code ===
        prototype.functionalAmount.currency.code &&
      (account.currency === null ||
        line.amount.currency.code === account.currency.code)
  );

  if (!valid) {
    throw new journalEntryError.MismatchedJournalLines({
      cause: lines.map((line) => ({
        accountId: line.accountId,
        functionalCurrency: line.functionalAmount.currency,
        currency: line.amount.currency,
      })),
    });
  }
}

function calculateDirectDelta(account: ILedgerAccount, lines: IJournalLine[]) {
  validateLines(lines, account);

  const functionalCurrency = lines[0].functionalAmount.currency;
  const balanceCurrency = account.currency ?? functionalCurrency;
  let amount = moneyValue.makeZeroAmount(balanceCurrency);
  let functionalAmount = moneyValue.makeZeroAmount(functionalCurrency);

  for (const line of lines) {
    const effect = ledgerBalanceEffectRule(account, line.side);
    const accountAmount = account.currency
      ? line.amount
      : line.functionalAmount;

    if (effect === ELedgerAccountBalanceEffect.Increase) {
      amount = moneyValue.add(amount, accountAmount);
      functionalAmount = moneyValue.add(
        functionalAmount,
        line.functionalAmount
      );
    } else {
      amount = moneyValue.subtract(amount, accountAmount);
      functionalAmount = moneyValue.subtract(
        functionalAmount,
        line.functionalAmount
      );
    }
  }

  return { amount, functionalAmount };
}

function getPathHierarchy(materializedPath: string) {
  const segments = materializedPath.split('.');
  return segments.map((_, index) => segments.slice(0, index + 1).join('.'));
}

function aggregateDelta(
  aggregate: Map<TEntityId, ILedgerAccountBalanceDelta>,
  account: ILedgerAccount,
  directAmount: IMoney,
  functionalAmount: IMoney
) {
  const amount =
    account.currency?.code === directAmount.currency.code
      ? directAmount
      : functionalAmount;
  const existing = aggregate.get(account.id);

  aggregate.set(account.id, {
    ledgerAccountId: account.id,
    amount: existing ? moneyValue.add(existing.amount, amount) : amount,
    functionalAmount: existing
      ? moneyValue.add(existing.functionalAmount, functionalAmount)
      : functionalAmount,
  });
}

function calculate(journalEntry: IJournalEntry, accounts: ILedgerAccount[]) {
  const accountsById = new Map(
    accounts.map((account) => [account.id, account])
  );
  const accountsByPath = new Map(
    accounts.map((account) => [account.materializedPath, account])
  );
  const aggregate = new Map<TEntityId, ILedgerAccountBalanceDelta>();

  for (const [accountId, lines] of groupLinesByAccount(journalEntry)) {
    const directAccount = accountsById.get(accountId);

    if (!directAccount) {
      throw new journalEntryError.AccountNotFound({ cause: { accountId } });
    }

    if (directAccount.subType === EEquitySubType.OpeningBalance) {
      continue;
    }

    const directDelta = calculateDirectDelta(directAccount, lines);

    for (const path of getPathHierarchy(directAccount.materializedPath)) {
      const account = accountsByPath.get(path);

      if (!account) {
        throw new journalEntryError.AccountNotFound({
          cause: { materializedPath: path },
        });
      }

      aggregateDelta(
        aggregate,
        account,
        directDelta.amount,
        directDelta.functionalAmount
      );
    }
  }

  return [...aggregate.values()];
}

const ledgerAccountBalanceAdjustmentService: ILedgerAccountBalanceAdjustmentService =
  Object.freeze({ calculate });

export default ledgerAccountBalanceAdjustmentService;
