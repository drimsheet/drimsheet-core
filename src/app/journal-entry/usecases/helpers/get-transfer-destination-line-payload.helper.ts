import { ICreateTransferEntryPayload } from '@domain/journal-entry/types/journal-entry.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

/**
 * Builds the transfer destination line with domain money and exchange rate.
 */
export default function getTransferDestinationLinePayloadHelper(
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
