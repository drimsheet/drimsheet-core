import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ICreateTransferEntryPayload } from '@domain/journal-entry/types/transfer-entry.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

/**
 * Builds journal charge lines using resolved accounts and counterparties.
 * Preserves charge order and uses null when no counterparty matches.
 */
export default function transformTransferChargeLinesToJournalLinesHelper(
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
