import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalEntryRectificationValidation from '@domain/journal-entry/services/validations/journal-entry-rectification.validation';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

describe('journalEntryRectificationValidation', () => {
  function makeEntry() {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.USD, false);

    return journalEntryEntity.make({
      accountingEntityId: generateUUID(),
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
      postedAt: null,
      memo: null,
      createdBy: generateUUID(),
      functionalCurrency: SYSTEM_CURRENCIES.USD,
      lines: [
        {
          accountId: generateUUID(),
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.USD,
        },
        {
          accountId: generateUUID(),
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.USD,
        },
      ],
    })[0];
  }

  it('accepts a rectifiable journal entry and new journal-entry state', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: { id: generateUUID(), memo: 'Corrected' },
      })
    ).not.toThrow();
  });

  it('rejects a journal entry that is already voided', () => {
    const originalEntry = {
      ...makeEntry(),
      status: EJournalEntryStatus.Voided,
    };

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: { id: generateUUID(), memo: 'Corrected' },
      })
    ).toThrow(journalEntryError.RectificationNotPermitted);
  });

  it('rejects a journal entry that is already archived', () => {
    const originalEntry = {
      ...makeEntry(),
      status: EJournalEntryStatus.Archived,
    };

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: { id: generateUUID(), memo: 'Corrected' },
      })
    ).toThrow(journalEntryError.RectificationNotPermitted);
  });

  it('accepts journal-entry state without a correction', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          attachments: originalEntry.attachments,
          memo: originalEntry.memo,
          status: originalEntry.status,
          effectiveDate: originalEntry.effectiveDate,
          postedAt: originalEntry.postedAt,
          lines: originalEntry.lines,
        },
      })
    ).not.toThrow();
  });

  it('rejects duplicate rectification line IDs', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          lines: [
            originalEntry.lines[0],
            { ...originalEntry.lines[1], id: originalEntry.lines[0].id },
          ],
        },
      })
    ).toThrow(journalEntryError.RectificationLineId);
  });

  it('accepts a new unique line ID', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          lines: [
            originalEntry.lines[0],
            { ...originalEntry.lines[1], id: generateUUID() },
          ],
        },
      })
    ).not.toThrow();
  });

  it('accepts equivalent creator attribution after serialization', () => {
    const originalEntry = makeEntry();
    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          createdBy: originalEntry.createdBy,
          memo: 'changed',
        },
      })
    ).not.toThrow();
  });

  it('rejects changes to the owning fields', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          createdBy: generateUUID(),
        },
      })
    ).toThrow(journalEntryError.RectificationNotPermitted);
  });

  it('rejects a source type that differs from the original journal entry', () => {
    const originalEntry = makeEntry();

    expect(() =>
      journalEntryRectificationValidation.validatePayload({
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          sourceType: EJournalEntrySourceType.Payment,
        },
      })
    ).toThrow(journalEntryError.RectificationNotPermitted);
  });
});
