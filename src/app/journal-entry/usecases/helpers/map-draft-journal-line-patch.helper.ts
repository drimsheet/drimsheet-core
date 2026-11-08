import { TEntityId } from '@shared/types/uuid';

import { TDraftJournalLinePatch } from '@domain/journal-entry/types/journal-entry.service.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

/** Converts supplied fields to domain values while preserving explicit nulls. */
export default function mapDraftJournalLinePatchHelper(
  line: Partial<IJournalLineReq> & { id?: string }
): TDraftJournalLinePatch {
  return {
    id: line.id as TEntityId | undefined,
    accountId: line.accountId as TEntityId | undefined,
    counterpartyId: line.counterpartyId as TEntityId | null | undefined,
    sequenceOrder: line.sequenceOrder,
    amount: line.amount && moneyMapper.fromDto(line.amount),
    exchangeRate: line.exchangeRate
      ? exchangeRateValue.make(line.exchangeRate)
      : line.exchangeRate,
    description: line.description,
  };
}
