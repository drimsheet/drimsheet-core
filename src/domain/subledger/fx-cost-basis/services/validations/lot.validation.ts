import journalEntryRuleValidator from '@domain/journal-entry/rules/entry-rule.validator';
import {
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  IJournalLine,
  UJournalSide,
} from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import fxCostBasisLotAccountRule from '@domain/subledger/fx-cost-basis/rules/fx-cost-basis-lot-account.rule';
import { IFxCostBasisLotOperationPayload } from '@domain/subledger/fx-cost-basis/types/lot.service.types';

function hasFxCostBasisEffect(
  account: ILedgerAccount,
  journalLine: IJournalLine
) {
  const isFxCashAccount =
    journalEntryRuleValidator(account, fxCostBasisLotAccountRule) &&
    !account.isControlAccount &&
    account.currency !== null;

  if (!isFxCashAccount) {
    return false;
  }

  return account.currency!.code !== journalLine.functionalAmount.currency.code;
}

function validateJournalStatus(journalEntry: IJournalEntry) {
  if (journalEntry.status !== EJournalEntryStatus.Posted) {
    throw new fxCostBasisLotError.InvalidJournalStatus({
      actualStatus: journalEntry.status,
    });
  }
}

function validateFxLine(
  payload: IFxCostBasisLotOperationPayload,
  journalLine: IJournalLine,
  expectedSide: UJournalSide
) {
  if (journalLine.side !== expectedSide) {
    throw new fxCostBasisLotError.InvalidJournalSide({
      expectedSide,
      actualSide: journalLine.side,
    });
  }

  const accountCurrencyCode = payload.account.currency!.code;

  const transactionRate = journalLine.exchangeRate;
  const isInvalidTransactionRate =
    transactionRate?.baseCurrencyCode !== accountCurrencyCode ||
    transactionRate.targetCurrencyCode !==
      journalLine.functionalAmount.currency.code;

  if (isInvalidTransactionRate) {
    throw new fxCostBasisLotError.InvalidTransactionRate({ transactionRate });
  }

  exchangeRateValue.validate(transactionRate);

  const isInvalidOfficialRate =
    payload.officialRate &&
    (payload.officialRate.baseCurrencyCode !== accountCurrencyCode ||
      payload.officialRate.targetCurrencyCode !==
        journalLine.functionalAmount.currency.code);

  if (isInvalidOfficialRate) {
    throw new fxCostBasisLotError.InvalidOfficialRate({
      officialRate: payload.officialRate,
    });
  }
}

const fxCostBasisLotValidation = Object.freeze({
  hasFxCostBasisEffect,
  validateJournalStatus,
  validateFxLine,
});

export default fxCostBasisLotValidation;
