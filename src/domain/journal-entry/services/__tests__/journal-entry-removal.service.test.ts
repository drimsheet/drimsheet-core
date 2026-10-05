import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRemovalService from '@domain/journal-entry/services/journal-entry-removal.service';
import { IJournalEntryRectificationService } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { EJournalEntryRemovalMode } from '@domain/journal-entry/types/journal-entry-removal.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
  UJournalEntrySourceType,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

describe('makeJournalEntryRemovalService', () => {
  const postedAt = new Date('2026-09-22T10:00:00.000Z');
  const reversalResult = {
    originalJournalEntryId: generateUUID(),
  } as Awaited<ReturnType<IJournalEntryRectificationService['reverse']>>;
  const journalEntryRectificationService: jest.Mocked<IJournalEntryRectificationService> =
    {
      rectify: jest.fn(),
      reverse: jest.fn(),
    };
  const service = makeJournalEntryRemovalService({
    journalEntryRectificationService,
  });

  function makeEntry(
    sourceType: UJournalEntrySourceType,
    postingDate: Date | null
  ) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId: generateUUID(),
      sourceType,
      effectiveDate: postedAt,
      postedAt: postingDate,
      memo: null,
      createdBy: generateUUID(),
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: generateUUID(),
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: generateUUID(),
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    })[0];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    journalEntryRectificationService.reverse.mockResolvedValue(reversalResult);
  });

  it('exposes an immutable prepare capability', () => {
    expect(Object.keys(service)).toEqual(['prepare']);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it('propagates an archived-account rejection from reversal preparation', async () => {
    const entry = makeEntry(EJournalEntrySourceType.Expense, postedAt);
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    const repoOptions = { correlationId: 'removal-account-check' };
    journalEntryRectificationService.reverse.mockRejectedValueOnce(failure);

    await expect(
      service.prepare(entry, entry.createdBy, repoOptions)
    ).rejects.toBe(failure);
    expect(journalEntryRectificationService.reverse).toHaveBeenCalledWith(
      entry,
      entry.createdBy,
      repoOptions
    );
  });

  it.each([
    ['draft', makeEntry(EJournalEntrySourceType.Expense, null)],
    [
      'never-posted archived',
      {
        ...makeEntry(EJournalEntrySourceType.Expense, null),
        status: EJournalEntryStatus.Archived,
      },
    ],
  ])('selects total deletion for a %s entry', async (_, entry) => {
    expect(
      await service.prepare(
        entry,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId: 'test-correlation-id' }
      )
    ).toEqual({
      mode: EJournalEntryRemovalMode.Delete,
      originalJournalEntryId: entry.id,
    });
    expect(journalEntryRectificationService.reverse).not.toHaveBeenCalled();
  });

  it.each([
    ['posted', makeEntry(EJournalEntrySourceType.Expense, postedAt)],
    [
      'previously-posted archived',
      {
        ...makeEntry(EJournalEntrySourceType.Expense, postedAt),
        status: EJournalEntryStatus.Archived,
      },
    ],
  ])('prepares reversal for a %s entry', async (_, entry) => {
    expect(
      await service.prepare(
        entry,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId: 'test-correlation-id' }
      )
    ).toEqual({
      mode: EJournalEntryRemovalMode.Reverse,
      ...reversalResult,
    });
    expect(journalEntryRectificationService.reverse).toHaveBeenCalledWith(
      entry,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      { correlationId: 'test-correlation-id' }
    );
  });

  it.each([
    makeEntry(EJournalEntrySourceType.Reversal, postedAt),
    {
      ...makeEntry(EJournalEntrySourceType.Reversal, postedAt),
      status: EJournalEntryStatus.Archived,
    },
    makeEntry(EJournalEntrySourceType.Reversal, null),
  ])('rejects reversal source type before mode selection', async (entry) => {
    await expect(
      service.prepare(
        entry,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId: 'test-correlation-id' }
      )
    ).rejects.toThrow(journalEntryError.DeletionNotPermitted);
    expect(journalEntryRectificationService.reverse).not.toHaveBeenCalled();
  });

  it.each([
    {
      ...makeEntry(EJournalEntrySourceType.Expense, postedAt),
      status: EJournalEntryStatus.Voided,
    },
    {
      ...makeEntry(EJournalEntrySourceType.Expense, null),
      postedAt,
    },
    {
      ...makeEntry(EJournalEntrySourceType.Expense, postedAt),
      postedAt: null,
    },
  ] satisfies IJournalEntry[])(
    'rejects an invalid removal state',
    async (entry) => {
      await expect(
        service.prepare(
          entry,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          { correlationId: 'test-correlation-id' }
        )
      ).rejects.toThrow(journalEntryError.DeletionNotPermitted);
      expect(journalEntryRectificationService.reverse).not.toHaveBeenCalled();
    }
  );
});
