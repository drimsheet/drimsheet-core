import { isEqual } from 'lodash';

import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import serializeBigIntInObj from '@shared/utils/serialize-bigint-in-object';
import stringUtils from '@shared/utils/string';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLine,
} from '@domain/journal-entry/types/journal-line.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

function validateStatus(status: UJournalEntryStatus) {
  if (!Object.values(EJournalEntryStatus).includes(status)) {
    throw new journalEntryError.InvalidStatus({ status });
  }
}

function validateTransition(
  currentStatus: UJournalEntryStatus,
  nextStatus: UJournalEntryStatus,
  allowedStatuses: UJournalEntryStatus[]
) {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new journalEntryError.InvalidStatusTransition({
      currentStatus,
      nextStatus,
    });
  }
}

function isUniqueSequenceOrder(lines: IJournalLine[]) {
  const sequenceOrders = lines.map((item) => item.sequenceOrder);
  const uniqueSequenceOrders = new Set(sequenceOrders);

  return sequenceOrders.length === uniqueSequenceOrders.size;
}

function validateLine(lines: IJournalLine[]) {
  if (!lines.length || lines.length < 2) {
    throw new journalEntryError.InvalidLineItems({ lines });
  }

  const debits: IMoney[] = [];
  const credits: IMoney[] = [];

  for (const item of lines) {
    const zeroAmount = moneyValue.makeZeroAmount(item.amount.currency);

    if (moneyValue.isLessThan(item.amount, zeroAmount)) {
      throw new journalEntryError.InvalidJournalLineItem({
        item: serializeBigIntInObj({
          sequenceOrder: item.sequenceOrder,
          side: item.side,
          amount: item.amount,
        }),
      });
    }

    if (item.side === EJournalSide.Debit) {
      debits.push(item.functionalAmount);
    } else if (item.side === EJournalSide.Credit) {
      credits.push(item.functionalAmount);
    } else {
      throw new journalEntryError.InvalidJournalLineItem({ item });
    }
  }

  if (!debits.length || !credits.length) {
    throw new journalEntryError.InvalidLineItems({ lines });
  }

  const totalDebits = moneyValue.add(...debits);
  const totalCredits = moneyValue.add(...credits);

  if (!moneyValue.equals(totalDebits, totalCredits)) {
    throw new journalEntryError.UnbalancedJournalEntry({
      lines: serializeBigIntInObj(lines).map((line) => ({
        amount: line.amount,
        side: line.side,
      })),
    });
  }

  if (!isUniqueSequenceOrder(lines)) {
    throw new journalEntryError.DuplicateSequenceOrders({
      lines: serializeBigIntInObj(lines).map((line) => ({
        amount: line.amount,
        side: line.side,
      })),
    });
  }
}

function validateSourceType(sourceType: UJournalEntrySourceType) {
  if (!Object.values(EJournalEntrySourceType).includes(sourceType)) {
    throw new journalEntryError.InvalidSourceType({ sourceType });
  }
}

function validateCounterparties(
  sourceType: UJournalEntrySourceType,
  lines: IJournalLine[]
) {
  const hasSourceCounterparty = lines.some((line) => {
    const isSourceLine = line.side === EJournalSide.Credit;
    const hasCounterparty = line.counterpartyId !== null;

    return isSourceLine && hasCounterparty;
  });
  const isTransferWithSourceCounterparty =
    sourceType === EJournalEntrySourceType.Transfer && hasSourceCounterparty;

  if (isTransferWithSourceCounterparty) {
    throw new journalEntryError.CounterpartyIdNotAllowed();
  }
}

function validatePostedAt(value: Date | null) {
  if (value) {
    dateUtils.validateDate(value, journalEntryError.InvalidPostingDate);
  }
}

function validateVoidedAt(value: Date | null) {
  if (value) {
    dateUtils.validateDate(value, journalEntryError.InvalidVoidedAt);
  }
}

function validateVoidingEntryId(value: TEntityId | null) {
  if (value) {
    stringUtils.validateUUID(value, journalEntryError.InvalidVoidingEntryId);
  }
}

function validateVoid(entry: IJournalEntry) {
  const isPosted = entry.status === EJournalEntryStatus.Posted;
  const isArchivedAfterPosting =
    entry.status === EJournalEntryStatus.Archived && entry.postedAt !== null;

  if (!isPosted && !isArchivedAfterPosting) {
    throw new journalEntryError.InvalidStatusTransition({
      currentStatus: entry.status,
      nextStatus: EJournalEntryStatus.Voided,
    });
  }
}

function hasOnlyMetadataChanges(
  entry: IJournalEntry,
  newEntry: Partial<IJournalEntry> & { id: TEntityId }
) {
  const lines = newEntry.lines ?? entry.lines;
  const hasHeaderAccountingChange =
    (newEntry.accountingEntityId !== undefined &&
      newEntry.accountingEntityId !== entry.accountingEntityId) ||
    (newEntry.sourceType !== undefined &&
      newEntry.sourceType !== entry.sourceType) ||
    (newEntry.memo !== undefined && newEntry.memo !== entry.memo) ||
    (newEntry.status !== undefined && newEntry.status !== entry.status) ||
    (newEntry.effectiveDate !== undefined &&
      !isEqual(newEntry.effectiveDate, entry.effectiveDate)) ||
    (newEntry.postedAt !== undefined &&
      !isEqual(newEntry.postedAt, entry.postedAt));

  if (hasHeaderAccountingChange || lines.length !== entry.lines.length) {
    return false;
  }

  for (const line of lines) {
    const originalLine = entry.lines.find((item) => item.id === line.id);

    if (!originalLine) {
      return false;
    }

    const hasAccountingLineChange =
      originalLine.accountId !== line.accountId ||
      originalLine.counterpartyId !== line.counterpartyId ||
      originalLine.sequenceOrder !== line.sequenceOrder ||
      !moneyValue.equals(originalLine.amount, line.amount) ||
      !isEqual(originalLine.exchangeRate, line.exchangeRate) ||
      !moneyValue.equals(
        originalLine.functionalAmount,
        line.functionalAmount
      ) ||
      originalLine.side !== line.side ||
      !isEqual(originalLine.meta, line.meta);

    if (hasAccountingLineChange) {
      return false;
    }
  }

  return true;
}

function validateUpdate(
  entry: IJournalEntry,
  newEntry: Partial<IJournalEntry> & { id: TEntityId }
) {
  const isUpdatable =
    entry.status === EJournalEntryStatus.Draft ||
    entry.status === EJournalEntryStatus.Posted;

  if (!isUpdatable) {
    throw new journalEntryError.RectificationNotPermitted({
      status: entry.status,
    });
  }

  const changesOwner =
    (newEntry.accountingEntityId !== undefined &&
      newEntry.accountingEntityId !== entry.accountingEntityId) ||
    (newEntry.sourceType !== undefined &&
      newEntry.sourceType !== entry.sourceType) ||
    (newEntry.createdBy !== undefined &&
      !isEqual(newEntry.createdBy, entry.createdBy));

  if (changesOwner) {
    throw new journalEntryError.RectificationNotPermitted();
  }

  const nextStatus = newEntry.status ?? entry.status;
  const hasInvalidDraftStatus =
    entry.status === EJournalEntryStatus.Draft &&
    nextStatus !== EJournalEntryStatus.Draft &&
    nextStatus !== EJournalEntryStatus.Posted;

  if (hasInvalidDraftStatus) {
    throw new journalEntryError.InvalidStatusTransition({
      currentStatus: entry.status,
      nextStatus,
    });
  }

  const changesPostedAccountingValues =
    entry.status === EJournalEntryStatus.Posted &&
    !hasOnlyMetadataChanges(entry, newEntry);

  if (changesPostedAccountingValues) {
    throw new journalEntryError.RectificationNotPermitted();
  }
}

function validateBalancePropagation(entry: IJournalEntry) {
  const isPosted = entry.status === EJournalEntryStatus.Posted;
  const isArchivedAfterPosting =
    entry.status === EJournalEntryStatus.Archived && entry.postedAt !== null;

  if (!isPosted && !isArchivedAfterPosting) {
    throw new journalEntryError.InvalidJournalEntry({
      journalEntryId: entry.id,
    });
  }
}

const journalEntryValidation = Object.freeze({
  validateStatus,
  validateTransition,
  validateLine,
  isUniqueSequenceOrder,
  validateSourceType,
  validateCounterparties,
  validatePostedAt,
  validateVoidedAt,
  validateVoidingEntryId,
  validateVoid,
  hasOnlyMetadataChanges,
  validateUpdate,
  validateBalancePropagation,
});

export default journalEntryValidation;
