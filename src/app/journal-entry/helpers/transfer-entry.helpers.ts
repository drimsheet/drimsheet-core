import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ICreateTransferEntryPayload } from '@domain/journal-entry/types/journal-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

async function getChargeAccounts(
  chargeLines: IJournalLineReq[],
  accountingEntity: IAccountingEntity,
  repo: ILedgerAccountRepo,
  repoOptions: IReadRepoOptions
) {
  const chargeAccounts: ILedgerAccount[] = [];

  for (const chargeLine of chargeLines) {
    const chargeAccount = await repo.findById(
      chargeLine.accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!chargeAccount) {
      throw new ledgerAppError.AccountNotFound({
        id: chargeLine.accountId,
      });
    }

    chargeAccounts.push(chargeAccount);
  }

  return chargeAccounts;
}

function transformChargeLineToJournalLine(
  payload: ITransferEntryReq,
  counterparties: ICounterparty[],
  chargeAccounts: ILedgerAccount[]
): ICreateTransferEntryPayload['destinationLines'] {
  return payload.chargeLines.map((chargeLine, index) => {
    const counterparty =
      counterparties.find(
        (candidate) => candidate.id === chargeLine.counterpartyId
      ) ?? null;

    return {
      account: chargeAccounts[index],
      counterparty,
      sequenceOrder: chargeLine.sequenceOrder,
      amount: moneyMapper.fromDto(chargeLine.amount),
      exchangeRate: chargeLine.exchangeRate
        ? exchangeRateValue.make(chargeLine.exchangeRate)
        : null,
      description: chargeLine.description,
      meta: null,
    };
  });
}

function getSourceLinePayload(
  payload: ITransferEntryReq,
  sourceAccount: ILedgerAccount
): ICreateTransferEntryPayload['sourceLine'] {
  const sourceExchangeRate = payload.sourceLine.exchangeRate
    ? exchangeRateValue.make(payload.sourceLine.exchangeRate)
    : null;

  return {
    account: sourceAccount,
    sequenceOrder: payload.sourceLine.sequenceOrder,
    amount: moneyMapper.fromDto(payload.sourceLine.amount),
    exchangeRate: sourceExchangeRate,
    description: payload.sourceLine.description,
    meta: null,
  };
}

function getDestinationPayload(
  payload: ITransferEntryReq,
  account: ILedgerAccount
): ICreateTransferEntryPayload['destinationLines'][number] {
  return {
    account,
    counterparty: null,
    sequenceOrder: payload.destinationLine.sequenceOrder,
    amount: moneyMapper.fromDto(payload.destinationLine.amount),
    exchangeRate: payload.destinationLine.exchangeRate
      ? exchangeRateValue.make(payload.destinationLine.exchangeRate)
      : null,
    description: payload.destinationLine.description,
    meta: null,
  };
}

const transferEntryHelpers = Object.freeze({
  getSourceLinePayload,
  getDestinationPayload,
  getChargeAccounts,
  transformChargeLineToJournalLine,
});

export default transferEntryHelpers;
