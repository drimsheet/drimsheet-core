import { ICreateTransferEntryPayload } from '@domain/journal-entry/types/transfer-entry.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

/**
 * Builds the transfer source line with domain money and exchange-rate values.
 */
export default function getTransferSourceLinePayloadHelper(
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
