import { isEqual } from 'lodash';

import dateUtils from '@shared/utils/date';
import numberUtils from '@shared/utils/number';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { IEvent } from '@shared/values/events/types/event.types';

import getJournalLineDescription from '@domain/journal-entry/entities/helpers/get-description.helper';
import journalLineValidation from '@domain/journal-entry/entities/validations/journal-line.validation';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import journalLineEvents from '@domain/journal-entry/events/journal-line-item.events';
import {
  EJournalLineAuditAction,
  IJournalLineAudit,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import {
  IJournalLine,
  IJournalLineMakePayload,
} from '@domain/journal-entry/types/journal-line.types';
import journalLineAudit from '@domain/journal-entry/values/journal-line-audit.vo';
import moneyValue from '@domain/money/values/money.vo';

function make(
  entryPayload: Pick<IJournalEntry, 'id' | 'memo' | 'createdAt' | 'createdBy'>,
  payload: IJournalLineMakePayload
): [IJournalLine, IEvent<IJournalLine>[], IJournalLineAudit] {
  stringUtils.validateUUID(
    entryPayload.id,
    journalLineError.InvalidHeaderyEntryId
  );
  stringUtils.validateUUID(
    payload.accountId,
    journalLineError.InvalidAccountId
  );
  journalLineValidation.validateCounterpartyId(payload.counterpartyId ?? null);
  numberUtils.validateInteger(
    payload.sequenceOrder,
    journalLineError.InvalidSequenceOrder
  );
  moneyValue.validate(payload.amount);

  journalLineValidation.validateExchangeRate(payload);
  journalLineValidation.validateSide(payload.side);
  dateUtils.validateDate(
    entryPayload.createdAt,
    journalLineError.InvalidCreatedAt
  );

  const functionalAmount = payload.exchangeRate
    ? moneyValue.convert(
        payload.amount,
        payload.exchangeRate,
        payload.functionalCurrency
      )
    : payload.amount;
  const description = getJournalLineDescription(
    payload.description ?? entryPayload.memo
  );

  stringUtils.validateUUID(
    entryPayload.createdBy,
    journalLineError.InvalidCreatedBy
  );

  const id = payload.id ?? generateUUID();

  stringUtils.validateUUID(id, journalLineError.InvalidId);

  const lineItem: IJournalLine = {
    id,
    createdBy: entryPayload.createdBy,
    entryId: entryPayload.id,
    accountId: payload.accountId,
    counterpartyId: payload.counterpartyId ?? null,
    sequenceOrder: payload.sequenceOrder,
    amount: payload.amount,
    exchangeRate: payload.exchangeRate,
    functionalAmount,
    side: payload.side,
    description,
    meta: null,
    version: 1,
    createdAt: entryPayload.createdAt,
    updatedAt: entryPayload.createdAt,
  };

  const event = journalLineEvents.created(lineItem);
  const audit = journalLineAudit.make({
    before: null,
    after: lineItem,
    action: EJournalLineAuditAction.Created,
  });

  return [Object.freeze(lineItem), [event], audit];
}

function update(
  line: IJournalLine,
  payload: IJournalLine
): [IJournalLine, IEvent<IJournalLine>[], IJournalLineAudit | null] {
  stringUtils.validateUUID(
    payload.accountId,
    journalLineError.InvalidAccountId
  );
  journalLineValidation.validateCounterpartyId(payload.counterpartyId);
  numberUtils.validateInteger(
    payload.sequenceOrder,
    journalLineError.InvalidSequenceOrder
  );
  moneyValue.validate(payload.amount);
  journalLineValidation.validateExchangeRate({
    amount: payload.amount,
    functionalCurrency: payload.functionalAmount.currency,
    exchangeRate: payload.exchangeRate,
  });
  journalLineValidation.validateSide(payload.side);

  const functionalAmount = payload.exchangeRate
    ? moneyValue.convert(
        payload.amount,
        payload.exchangeRate,
        payload.functionalAmount.currency
      )
    : payload.amount;
  const description = getJournalLineDescription(payload.description);
  const isUnchanged =
    line.accountId === payload.accountId &&
    line.counterpartyId === payload.counterpartyId &&
    line.sequenceOrder === payload.sequenceOrder &&
    moneyValue.equals(line.amount, payload.amount) &&
    isEqual(line.exchangeRate, payload.exchangeRate) &&
    moneyValue.equals(line.functionalAmount, functionalAmount) &&
    line.side === payload.side &&
    line.description === description &&
    isEqual(line.meta, payload.meta);

  if (isUnchanged) {
    return [line, [], null];
  }

  const updatedLine: IJournalLine = Object.freeze({
    id: line.id,
    createdBy: line.createdBy,
    entryId: line.entryId,
    accountId: payload.accountId,
    counterpartyId: payload.counterpartyId,
    sequenceOrder: payload.sequenceOrder,
    amount: payload.amount,
    exchangeRate: payload.exchangeRate,
    functionalAmount,
    side: payload.side,
    description,
    meta: payload.meta,
    version: line.version + 1,
    createdAt: line.createdAt,
    updatedAt: new Date(),
  });
  const event = journalLineEvents.updated(updatedLine);
  const audit = journalLineAudit.make({
    before: line,
    after: updatedLine,
    action: EJournalLineAuditAction.Updated,
  });

  return [updatedLine, [event], audit];
}

const journalLineEntity = Object.freeze({
  make,
  update,
  ...journalLineValidation,
});

export default journalLineEntity;
