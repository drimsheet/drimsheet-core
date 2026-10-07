import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeArchiveJournalEntryUsecase from '@app/journal-entry/usecases/archive-journal-entry.usecase';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeArchiveJournalEntryUsecase', () => {
  const correlationId = 'archive-correlation-id';
  const idempotencyKey = 'archive-idempotency-key';
  const accountingEntityId = generateUUID();
  const userId = generateUUID();
  const now = new Date('2026-09-22T10:00:00.000Z');
  const usecase = makeArchiveJournalEntryUsecase({
    appContext: mockAppContext,
    eventBus: mockEventBus,
    journalEntryRepo: mockJournalEntryRepo,
  });

  function makeEntry(postedAt: Date | null = now) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: now,
      postedAt,
      memo: 'Transfer',
      createdBy: userId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments: [],
      lines: [
        {
          accountId: generateUUID(),
          counterpartyId: null,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: generateUUID(),
          counterpartyId: null,
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    })[0];
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey,
      accountingEntity: { id: accountingEntityId },
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockEventBus.publish.mockResolvedValue();
    mockJournalEntryRepo.update.mockResolvedValue();
  });

  afterEach(() => jest.useRealTimers());

  it.each([
    ['posted', now],
    ['draft', null],
  ])(
    'archives a %s entry with history before publishing its event',
    async (_, postedAt) => {
      const entry = makeEntry(postedAt);
      mockJournalEntryRepo.findById.mockResolvedValue(entry);

      const response = await usecase(entry.id);

      expect(response).toMatchObject({
        id: entry.id,
        status: EJournalEntryStatus.Archived,
        postedAt,
      });
      expect(mockJournalEntryRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: entry.id,
          status: EJournalEntryStatus.Archived,
          version: entry.version + 1,
        }),
        expect.objectContaining({
          correlationId,
          expectedVersion: entry.version,
          history: expect.objectContaining({
            action: EJournalEntryAuditAction.Archived,
          }),
        })
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(
        mockJournalEntryRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
    }
  );

  it('rejects invalid input before reading context or persistence', async () => {
    await expect(usecase('not-a-uuid')).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    [
      'outside the active accounting entity',
      {
        entry: makeEntry(),
        accountingEntityId: generateUUID(),
        createdBy: generateUUID(),
        version: 99,
      },
    ],
  ])('hides an entry that is %s', async (_, storedEntry) => {
    const entry = storedEntry
      ? {
          ...storedEntry.entry,
          accountingEntityId: storedEntry.accountingEntityId,
          createdBy: storedEntry.createdBy,
          version: storedEntry.version,
        }
      : null;
    mockJournalEntryRepo.findById.mockResolvedValue(entry);

    await expect(usecase(generateUUID())).rejects.toThrow(
      appError.ResourceNotFound
    );

    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish when persistence fails', async () => {
    const entry = makeEntry();
    const failure = new Error('write failed');
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRepo.update.mockRejectedValueOnce(failure);

    await expect(usecase(entry.id)).rejects.toBe(failure);

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('passes the repository conflict from a concurrent update through', async () => {
    const entry = makeEntry();
    const conflict = new appError.Conflict();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRepo.update.mockRejectedValueOnce(conflict);

    await expect(usecase(entry.id)).rejects.toBe(conflict);
  });
});
