import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import {
  EJournalEntryRectificationMode,
  IJournalEntryRectificationResult,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import helpers from '@app/journal-entry/usecases/helpers/rectify-journal-entry.usecase.helpers';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

describe('rectifyJournalEntryUseCaseHelpers', () => {
  const actor = generateUUID();
  const correlationId = 'correlation-id';
  beforeEach(() => mockLedgerAccountRepo.findAllByIds.mockResolvedValue([]));

  function makeEntry(amountValue = 100, postedAt: Date | null = null) {
    const amount = moneyValue.make(amountValue, SYSTEM_CURRENCIES.USD, false);

    return journalEntryEntity.make({
      accountingEntityId: generateUUID(),
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
      postedAt,
      memo: 'Memo',
      createdBy: actor,
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
    });
  }

  it('maps histories for created entries and an entry update', async () => {
    const [originalEntry] = makeEntry();
    const [newEntry] = makeEntry(125);
    const rectification = await makeJournalEntryRectificationService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    }).rectify(
      {
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          ...newEntry,
          accountingEntityId: originalEntry.accountingEntityId,
          sourceType: originalEntry.sourceType,
          createdBy: originalEntry.createdBy,
          lines: newEntry.lines.map((line, index) => ({
            ...line,
            id: originalEntry.lines[index].id,
          })),
        },
      },
      { correlationId: 'test-correlation-id' }
    );

    const payload = getJournalEntryPersistencePayloadHelper(
      rectification,
      actor,
      correlationId
    );

    expect(payload.entriesToCreate).toEqual([]);
    expect(payload.entryUpdate?.headerHistory.actorId).toEqual(actor);
    expect(payload.entryUpdate?.lineHistories).toHaveLength(2);
  });

  it('supports a result without an entry update', () => {
    const [entry] = makeEntry();
    const result = {
      mode: EJournalEntryRectificationMode.UpdateMeta,
      originalJournalEntryId: entry.id,
      currentJournalEntry: entry,
      reversingJournalEntry: null,
      entriesToCreate: [],
      entryUpdate: null,
      events: [],
    } as IJournalEntryRectificationResult;

    expect(
      getJournalEntryPersistencePayloadHelper(result, actor, correlationId)
    ).toEqual({ entriesToCreate: [], entryUpdate: null });
  });

  it('propagates reversing and posted current entries except metadata updates', () => {
    const [postedEntry] = makeEntry(100, new Date('2026-09-01T00:00:00.000Z'));
    const [reversingEntry] = makeEntry(
      100,
      new Date('2026-09-02T00:00:00.000Z')
    );

    expect(
      helpers.getEntriesForBalancePropagation({
        mode: EJournalEntryRectificationMode.VoidAndReplace,
        originalJournalEntryId: postedEntry.id,
        currentJournalEntry: postedEntry,
        reversingJournalEntry: reversingEntry,
        entriesToCreate: [],
        entryUpdate: null,
        events: [],
      })
    ).toEqual([reversingEntry, postedEntry]);

    expect(
      helpers.getEntriesForBalancePropagation({
        mode: EJournalEntryRectificationMode.UpdateMeta,
        originalJournalEntryId: postedEntry.id,
        currentJournalEntry: postedEntry,
        reversingJournalEntry: null,
        entriesToCreate: [],
        entryUpdate: null,
        events: [],
      })
    ).toEqual([]);
  });
});
