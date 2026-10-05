import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import {
  EJournalEntryRectificationMode,
  IJournalEntryRectificationPayload,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findDescendants: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};

describe('makeJournalEntryRectificationService', () => {
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const debitAccountId = generateUUID();
  const creditAccountId = generateUUID();
  const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-09-21T09:30:00.000Z');
  const service = makeJournalEntryRectificationService({ ledgerAccountRepo });

  function makeAccount(id: TEntityId) {
    const [account] = ledgerAccountEntity.make({
      accountingEntityId,
      code: '100001',
      materializedPath: '100001',
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.Bank,
      normalBalance: EJournalSide.Debit,
      isControlAccount: false,
      controlAccountId: null,
      name: 'Reversal account',
      currency: SYSTEM_CURRENCIES.USD,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      meta: {},
      createdBy,
    });

    return Object.freeze({ ...account, id });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    ledgerAccountRepo.findAllByIds.mockResolvedValue([
      makeAccount(debitAccountId),
      makeAccount(creditAccountId),
    ]);
  });

  function makeEntry(options?: {
    posted?: boolean;
    amount?: number;
    memo?: string | null;
    description?: string | null;
    attachments?: { url: string; name: string; type: string; size: number }[];
  }) {
    const amount = moneyValue.make(
      options?.amount ?? 100,
      SYSTEM_CURRENCIES.USD,
      false
    );

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate,
      postedAt: options?.posted ? effectiveDate : null,
      memo: options?.memo ?? null,
      createdBy: createdBy,
      functionalCurrency: SYSTEM_CURRENCIES.USD,
      attachments: options?.attachments ?? [],
      lines: [
        {
          accountId: debitAccountId,
          counterpartyId: null,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: options?.description ?? null,
          functionalCurrency: SYSTEM_CURRENCIES.USD,
        },
        {
          accountId: creditAccountId,
          counterpartyId: null,
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

  function makePayload(
    originalEntry: IJournalEntry,
    newEntryResult: ReturnType<typeof makeEntry>
  ): IJournalEntryRectificationPayload {
    const [newEntry] = newEntryResult;

    return {
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      originalEntry,
      newEntry: {
        ...newEntry,
        lines: newEntry.lines.map((line, index) => ({
          ...line,
          id: originalEntry.lines[index]?.id ?? line.id,
        })),
      },
    };
  }

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterAll(() => jest.useRealTimers());

  it('rejects a reversal against an archived account without changing the original', async () => {
    const [originalEntry] = makeEntry({ posted: true });
    const snapshot = structuredClone(originalEntry);
    const account = makeAccount(debitAccountId);
    ledgerAccountRepo.findAllByIds.mockResolvedValue([
      ledgerAccountEntity.archive(account)[0],
      makeAccount(creditAccountId),
    ]);
    const repoOptions = { correlationId: 'reversal-account-check' };

    await expect(
      service.reverse(originalEntry, createdBy, repoOptions)
    ).rejects.toThrow(journalEntryError.ArchivedLedgerAccountNotAllowed);

    expect(ledgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      [debitAccountId, creditAccountId],
      repoOptions
    );
    expect(originalEntry).toEqual(snapshot);
    expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each(['original', 'replacement', 'draft'] as const)(
    'rejects an archived %s account inside rectification',
    async (kind) => {
      const [originalEntry] = makeEntry({ posted: kind !== 'draft' });
      const payload = makePayload(
        originalEntry,
        makeEntry({ posted: kind !== 'draft', amount: 125 })
      );
      const replacementAccountId = generateUUID();
      payload.newEntry.lines = payload.newEntry.lines!.map((line, index) =>
        index === 0 ? { ...line, accountId: replacementAccountId } : line
      );
      const archivedAccount = makeAccount(
        kind === 'original' ? debitAccountId : replacementAccountId
      );
      ledgerAccountRepo.findAllByIds.mockResolvedValue([
        ledgerAccountEntity.archive(archivedAccount)[0],
        makeAccount(creditAccountId),
      ]);

      await expect(
        service.rectify(payload, {
          correlationId: 'rectification-account-check',
        })
      ).rejects.toThrow(journalEntryError.ArchivedLedgerAccountNotAllowed);

      expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
    }
  );

  it('does not query accounts for a metadata-only update', async () => {
    const [originalEntry] = makeEntry({ posted: true });
    const payload = makePayload(
      originalEntry,
      makeEntry({ posted: true, description: 'Corrected description' })
    );
    ledgerAccountRepo.findAllByIds.mockResolvedValue([
      ledgerAccountEntity.archive(makeAccount(debitAccountId))[0],
    ]);

    const result = await service.rectify(payload, {
      correlationId: 'historical-metadata',
    });

    expect(result.mode).toBe(EJournalEntryRectificationMode.UpdateMeta);
    expect(result.entriesToCreate).toEqual([]);
    expect(ledgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
  });

  it('exposes only the rectify operation', () => {
    expect(Object.keys(service)).toEqual(['rectify', 'reverse']);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it.each([
    ['posted', false],
    ['previously-posted archived', true],
  ])('prepares a balanced reversal for a %s entry', async (_, archived) => {
    const [postedEntry] = makeEntry({ posted: true });
    const originalEntry = archived
      ? { ...postedEntry, status: EJournalEntryStatus.Archived }
      : postedEntry;

    const result = await service.reverse(
      originalEntry,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      { correlationId: 'test-correlation-id' }
    );

    expect(result.entriesToCreate).toHaveLength(1);
    expect(result.reversingJournalEntry).toMatchObject({
      sourceType: EJournalEntrySourceType.Reversal,
      status: EJournalEntryStatus.Posted,
      effectiveDate: now,
      postedAt: now,
    });
    expect(result.reversingJournalEntry.lines).toEqual([
      expect.objectContaining({
        accountId: originalEntry.lines[0].accountId,
        amount: originalEntry.lines[0].amount,
        side: EJournalSide.Credit,
      }),
      expect.objectContaining({
        accountId: originalEntry.lines[1].accountId,
        amount: originalEntry.lines[1].amount,
        side: EJournalSide.Debit,
      }),
    ]);
    expect(result.entryUpdate.entry).toMatchObject({
      id: originalEntry.id,
      status: EJournalEntryStatus.Voided,
      voidingEntryId: result.reversingJournalEntry.id,
    });
  });

  it('rejects reversal preparation for an archived entry that was never posted', async () => {
    const [draftEntry] = makeEntry();
    const archivedEntry = {
      ...draftEntry,
      status: EJournalEntryStatus.Archived,
    };

    await expect(
      service.reverse(
        archivedEntry,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId: 'test-correlation-id' }
      )
    ).rejects.toThrow(journalEntryError.InvalidStatusTransition);
  });

  it('updates a draft journal entry in place', async () => {
    const [originalEntry] = makeEntry();
    const newEntry = makeEntry({ amount: 125 });

    const result = await service.rectify(makePayload(originalEntry, newEntry), {
      correlationId: 'test-correlation-id',
    });

    expect(result.mode).toBe(EJournalEntryRectificationMode.UpdateDraft);
    expect(result.currentJournalEntry.id).toBe(originalEntry.id);
    expect(result.currentJournalEntry.version).toBe(2);
    expect(result.currentJournalEntry.lines[0]).toMatchObject({
      id: originalEntry.lines[0].id,
      entryId: originalEntry.id,
      version: 2,
    });
    expect(result.entriesToCreate).toEqual([]);
    expect(result.entryUpdate?.linesToUpdate).toHaveLength(2);
  });

  it('validates retained accounts when a draft correction omits lines', async () => {
    const [originalEntry] = makeEntry();

    const result = await service.rectify(
      {
        actorId: createdBy,
        originalEntry,
        newEntry: { id: originalEntry.id, memo: 'Corrected memo' },
      },
      { correlationId: 'retained-draft-accounts' }
    );

    expect(result.mode).toBe(EJournalEntryRectificationMode.UpdateDraft);
    expect(result.currentJournalEntry.lines).toEqual(originalEntry.lines);
    expect(ledgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      [debitAccountId, creditAccountId],
      { correlationId: 'retained-draft-accounts' }
    );
  });

  it('tracks deleted lines when updating a draft entry', async () => {
    const [originalEntry] = makeEntry();
    const newEntry = makePayload(originalEntry, makeEntry({ amount: 125 }));
    newEntry.newEntry.lines = [
      newEntry.newEntry.lines![0],
      { ...newEntry.newEntry.lines![1], id: generateUUID() },
    ];

    const result = await service.rectify(newEntry, {
      correlationId: 'test-correlation-id',
    });

    expect(result.entryUpdate?.lineIdsToDelete).toEqual([
      originalEntry.lines[1].id,
    ]);
  });

  it('updates only descriptions and attachments on a posted journal entry', async () => {
    const [originalEntry] = makeEntry({ posted: true });
    const newEntry = makeEntry({
      posted: true,
      description: 'Corrected description',
      attachments: [
        {
          url: 'https://files.example.com/corrected.pdf',
          name: 'corrected.pdf',
          type: 'application/pdf',
          size: 2_048,
        },
      ],
    });

    const result = await service.rectify(makePayload(originalEntry, newEntry), {
      correlationId: 'test-correlation-id',
    });

    expect(result.mode).toBe(EJournalEntryRectificationMode.UpdateMeta);
    expect(result.currentJournalEntry.id).toBe(originalEntry.id);
    expect(result.currentJournalEntry.status).toBe(EJournalEntryStatus.Posted);
    expect(result.currentJournalEntry.postedAt).toEqual(originalEntry.postedAt);
    expect(result.currentJournalEntry.lines[0].description).toBe(
      'Corrected description'
    );
    expect(result.currentJournalEntry.attachments).toHaveLength(1);
    expect(result.entryUpdate?.headerAudit.diff.before).toMatchObject({
      attachments: originalEntry.attachments,
    });
  });

  it('voids and replaces a posted journal entry when an accounting value changes', async () => {
    const [originalEntry] = makeEntry({ posted: true });
    const newEntry = makeEntry({ posted: true, amount: 150 });

    const result = await service.rectify(makePayload(originalEntry, newEntry), {
      correlationId: 'test-correlation-id',
    });

    expect(result.mode).toBe(EJournalEntryRectificationMode.VoidAndReplace);
    expect(result.entriesToCreate).toHaveLength(2);
    expect(result.reversingJournalEntry).toMatchObject({
      sourceType: EJournalEntrySourceType.Reversal,
      status: EJournalEntryStatus.Posted,
      effectiveDate: now,
      postedAt: now,
    });
    expect(
      result.reversingJournalEntry?.lines.map((line) => line.side)
    ).toEqual([EJournalSide.Credit, EJournalSide.Debit]);
    expect(result.entryUpdate?.entry).toMatchObject({
      id: originalEntry.id,
      status: EJournalEntryStatus.Voided,
      voidedAt: now,
      voidingEntryId: result.reversingJournalEntry?.id,
    });
    expect(result.currentJournalEntry).toMatchObject({
      id: newEntry[0].id,
      version: 1,
    });
    expect(result.currentJournalEntry.lines.map((line) => line.id)).not.toEqual(
      newEntry[0].lines.map((line) => line.id)
    );
  });

  it('voids and replaces a posted journal entry when its memo changes', async () => {
    const [originalEntry] = makeEntry({ posted: true, memo: 'Before' });
    const newEntry = makeEntry({ posted: true, memo: 'After' });

    const result = await service.rectify(makePayload(originalEntry, newEntry), {
      correlationId: 'test-correlation-id',
    });

    expect(result.mode).toBe(EJournalEntryRectificationMode.VoidAndReplace);
  });

  it('uses the original lines when a replacement omits lines', async () => {
    const [originalEntry] = makeEntry({ posted: true, memo: 'Before' });

    const result = await service.rectify(
      {
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: { id: generateUUID(), memo: null },
      },
      { correlationId: 'test-correlation-id' }
    );

    expect(result.currentJournalEntry.lines).toHaveLength(2);
  });

  it('uses the original memo when a replacement omits memo', async () => {
    const [originalEntry] = makeEntry({ posted: true, memo: 'Before' });

    const result = await service.rectify(
      {
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        originalEntry,
        newEntry: {
          id: generateUUID(),
          effectiveDate: new Date('2026-09-02T00:00:00.000Z'),
        },
      },
      { correlationId: 'test-correlation-id' }
    );

    expect(result.currentJournalEntry.memo).toBe('Before');
  });

  it('rejects a rectification with no changes', async () => {
    const [originalEntry] = makeEntry();
    const newEntry = makeEntry();

    await expect(
      service.rectify(makePayload(originalEntry, newEntry), {
        correlationId: 'test-correlation-id',
      })
    ).rejects.toThrow(journalEntryError.RectificationHasNoChanges);
  });

  it('rejects an already voided journal entry', async () => {
    const [entry] = makeEntry({ posted: true });
    const originalEntry: IJournalEntry = {
      ...entry,
      status: EJournalEntryStatus.Voided,
      voidedAt: now,
    };

    await expect(
      service.rectify(makePayload(originalEntry, makeEntry({ posted: true })), {
        correlationId: 'test-correlation-id',
      })
    ).rejects.toThrow(journalEntryError.RectificationNotPermitted);
  });
  it('attributes new reversal/replacement rows to the performer and keeps original creators', async () => {
    const [originalEntry] = makeEntry({ posted: true });
    const actorId = generateUUID();
    const payload = makePayload(
      originalEntry,
      makeEntry({ posted: true, amount: 150 })
    );
    const result = await service.rectify(
      { ...payload, actorId },
      { correlationId: 'test-correlation-id' }
    );
    expect(result.entryUpdate?.entry.createdBy).toBe(originalEntry.createdBy);
    expect(result.entriesToCreate).toHaveLength(2);
    for (const creation of result.entriesToCreate) {
      expect(creation[0].createdBy).toBe(actorId);
      expect(
        creation[0].lines.every((line) => line.createdBy === actorId)
      ).toBe(true);
    }
    const reversal = await service.reverse(originalEntry, actorId, {
      correlationId: 'test-correlation-id',
    });
    expect(reversal.reversingJournalEntry.createdBy).toBe(actorId);
    expect(reversal.entryUpdate.entry.createdBy).toBe(originalEntry.createdBy);
  });

  it('assigns the performer only to new lines while updating a draft', async () => {
    const [originalEntry] = makeEntry();
    const actorId = generateUUID();
    const newLineId = generateUUID();
    const payload = makePayload(originalEntry, makeEntry({ amount: 150 }));
    const result = await service.rectify(
      {
        ...payload,
        actorId,
        newEntry: {
          ...payload.newEntry,
          lines: payload.newEntry.lines!.map((line, index) => ({
            ...line,
            id: index === 0 ? originalEntry.lines[0].id : newLineId,
          })),
        },
      },
      { correlationId: 'test-correlation-id' }
    );
    expect(result.currentJournalEntry.createdBy).toBe(originalEntry.createdBy);
    expect(result.currentJournalEntry.lines[0].createdBy).toBe(
      originalEntry.lines[0].createdBy
    );
    expect(result.currentJournalEntry.lines[1].createdBy).toBe(actorId);
  });
});
