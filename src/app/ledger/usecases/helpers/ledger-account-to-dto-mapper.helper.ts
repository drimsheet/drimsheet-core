import {
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAccountMapper from '@app/ledger/dtos/ledger-account/ledger-account.dto.mapper';

function getBalance(
  account: ILedgerAccount,
  accountCurrency: ICurrency,
  accountLine?: IJournalLine
) {
  if (!accountLine) return moneyValue.makeZeroAmount(accountCurrency);

  return account.currency === null
    ? accountLine.functionalAmount
    : accountLine.amount;
}

export default function ledgerAccountToDtoMapperHelper(
  account: ILedgerAccount,
  journalEntry: IJournalEntry | null,
  functionalCurrencyCode: string
): ILedgerAccountDto {
  const postedJournal =
    journalEntry?.status === EJournalEntryStatus.Posted ? journalEntry : null;
  const accountLine = postedJournal?.lines.find(
    (line) => line.accountId === account.id
  );
  const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);

  const functionalBalance =
    accountLine?.functionalAmount ??
    moneyValue.makeZeroAmount(functionalCurrency);

  const accountCurrency = account.currency ?? functionalCurrency;

  const balance = getBalance(account, accountCurrency, accountLine);

  return ledgerAccountMapper.toDto(account, balance, functionalBalance);
}
