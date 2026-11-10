import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

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
import { IAppContextData } from '@app/context/types/app-context.types';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import {
  mockJournalEntryAttachmentRepo,
  mockJournalEntryRepo,
  mockJournalLineRepo,
} from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeUpdateJournalEntryMetaUsecase from '@app/journal-entry/usecases/update-journal-entry-meta.usecase';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeUpdateJournalEntryMetaUsecase', () => {
  const correlationId = 'archive-correlation-id';
  const idempotencyKey = 'archive-idempotency-key';
  const accountingEntityId = generateUUID();
  const userId = generateUUID();
  const now = new Date('2026-09-22T10:00:00.000Z');
  const attachment = {
    url: 'https://files.example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'application/pdf',
    size: 1024,
  };
  const usecase = makeUpdateJournalEntryMetaUsecase({
    appContext: mockAppContext,
    eventBus: mockEventBus,
    fileManagementAppService: mockFileManagementAppService,
    journalEntryAttachmentRepo: mockJournalEntryAttachmentRepo,
    journalEntryRepo: mockJournalEntryRepo,
    journalLineRepo: mockJournalLineRepo,
    repoService: mockRepoService,
  });

  function makeEntry(
    postedAt: Date | null = now,
    attachments: IFileAttachment[] = []
  ) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: now,
      postedAt,
      memo: 'Transfer',
      createdBy: userId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments,
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
    jest.resetAllMocks();
    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey,
      accountingEntity: { id: accountingEntityId },
      clientSession: mockClientSession,
      user: { id: userId },
    } as unknown as IAppContextData);
    mockEventBus.publish.mockResolvedValue();
    mockJournalEntryRepo.update.mockResolvedValue();
  });

  afterEach(() => jest.useRealTimers());

  it.each([now, null])(
    'saves metadata with history before publishing (postedAt=%s)',
    async (postedAt) => {
      const entry = makeEntry(postedAt);
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      const response = await usecase(entry.id, {
        header: { memo: 'Revised memo' },
        lines: [{ id: entry.lines[0].id, description: 'Revised line' }],
      });
      expect(response.memo).toBe('Revised memo');
      expect(response.lines[0].description).toBe('Revised line');
      expect(response.lines[1].description).toBe(entry.lines[1].description);
      expect(response).not.toHaveProperty('version');
      expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(entry.id, {
        correlationId,
        idempotencyKey,
      });
      expect(mockJournalEntryRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: entry.id,
          memo: 'Revised memo',
          version: entry.version + 1,
        }),
        expect.objectContaining({
          tx: mockRepoTransaction.context,
          expectedVersion: entry.version,
          history: expect.objectContaining({
            actorId: actor.id,
            correlationId,
            action: EJournalEntryAuditAction.Updated,
          }),
        })
      );
      expect(mockJournalLineRepo.update).toHaveBeenCalledTimes(1);
      expect(mockJournalLineRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: entry.lines[0].id,
          description: 'Revised line',
        }),
        expect.objectContaining({
          tx: mockRepoTransaction.context,
          accountingEntityId,
          expectedVersion: entry.lines[0].version,
          history: expect.objectContaining({ actorId: actor.id }),
        })
      );
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(
        mockJournalLineRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(
        mockJournalLineRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
    }
  );

  it('saves a header-only update without writing lines', async () => {
    const entry = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    expect(
      (await usecase(entry.id, { header: { memo: null } })).memo
    ).toBeNull();
    expect(mockJournalLineRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { header: {} },
    { lines: [] },
    { attachments: {} },
    { attachments: { add: [], remove: [] } },
  ])('skips all side effects for unchanged input %j', async (payload) => {
    const entry = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    await usecase(entry.id, payload);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockJournalEntryAttachmentRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('attaches an upload to a posted entry and audits it in the same transaction', async () => {
    const entry = makeEntry();
    const reference = generateUUID();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockFileManagementAppService.claimUploads.mockResolvedValue([attachment]);

    const response = await usecase(entry.id, {
      attachments: { add: [reference] },
    });

    expect(response.attachments).toEqual([attachment]);
    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: [reference],
    });
    expect(mockJournalEntryRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: entry.version + 1 }),
      expect.objectContaining({
        expectedVersion: entry.version,
        tx: mockRepoTransaction.context,
        history: expect.objectContaining({
          diff: expect.objectContaining({
            before: expect.objectContaining({ attachments: [] }),
            after: expect.objectContaining({ attachments: [attachment] }),
          }),
        }),
      })
    );
    expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledWith(
      entry.id,
      [attachment],
      {
        correlationId,
        tx: mockRepoTransaction.context,
      }
    );
    expect(
      mockJournalEntryAttachmentRepo.save.mock.invocationCallOrder[0]
    ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
    expect(mockJournalLineRepo.update).not.toHaveBeenCalled();
  });

  it('removes an existing attachment by its stored URL and preserves a different file on retry', async () => {
    const entry = makeEntry(now, [attachment]);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    const before = await usecase(entry.id, {});
    const payload = { attachments: { remove: [before.attachments[0].url] } };

    await expect(usecase(entry.id, payload)).resolves.toMatchObject({
      attachments: [],
    });
    expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledWith(
      entry.id,
      [],
      {
        correlationId,
        tx: mockRepoTransaction.context,
      }
    );

    const laterAttachment = {
      ...attachment,
      url: 'https://files.example.com/later-receipt.pdf',
    };
    mockJournalEntryRepo.findById.mockResolvedValue({
      ...entry,
      attachments: [laterAttachment],
    });
    await expect(usecase(entry.id, payload)).resolves.toMatchObject({
      attachments: [laterAttachment],
    });
    expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
  });

  it('treats a previously attached upload as a no-op', async () => {
    const entry = makeEntry(now, [attachment]);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    const payload = { attachments: { add: [generateUUID()] } };
    mockFileManagementAppService.claimUploads.mockResolvedValueOnce([
      attachment,
    ]);

    const response = await usecase(entry.id, payload);
    expect(response.attachments).toEqual([attachment]);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'adds a second attachment',
      remove: [],
      retained: [attachment],
    },
    {
      scenario: 'replaces an attachment',
      remove: [attachment.url],
      retained: [],
    },
  ])('$scenario', async ({ remove, retained }) => {
    const entry = makeEntry(now, [attachment]);
    const newAttachment = {
      ...attachment,
      name: 'confirmation.pdf',
      url: 'https://files.example.com/confirmation.pdf',
    };
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockFileManagementAppService.claimUploads.mockResolvedValue([
      newAttachment,
    ]);

    const response = await usecase(entry.id, {
      attachments: { add: [generateUUID()], remove },
    });

    const expectedAttachments = [...retained, newAttachment];
    expect(response.attachments).toEqual(expectedAttachments);
    expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledWith(
      entry.id,
      expectedAttachments,
      { correlationId, tx: mockRepoTransaction.context }
    );
  });

  it('rolls back the journal update when saving attachments fails', async () => {
    const entry = makeEntry();
    const failure = new appError.Conflict();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockFileManagementAppService.claimUploads.mockResolvedValue([attachment]);
    mockJournalEntryAttachmentRepo.save.mockRejectedValueOnce(failure);

    await expect(
      usecase(entry.id, { attachments: { add: [generateUUID()] } })
    ).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects invalid IDs and payloads before reading context', async () => {
    await expect(usecase('invalid', {})).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );
    await expect(
      usecase(generateUUID(), { header: { memo: 2 } } as never)
    ).rejects.toThrow(appError.UnprocessableEntity);
    await expect(
      usecase(generateUUID(), { amount: 200 } as never)
    ).rejects.toThrow(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
  });

  it.each(['missing', 'foreign'])(
    'rejects a %s entry before writes',
    async (kind) => {
      const entry = makeEntry();
      mockJournalEntryRepo.findById.mockResolvedValue(
        kind === 'missing'
          ? null
          : { ...entry, accountingEntityId: generateUUID() }
      );
      await expect(usecase(entry.id, {})).rejects.toThrow(
        appError.ResourceNotFound
      );
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it.each(['unknown', 'duplicate'])(
    'rejects %s line references without writes',
    async (kind) => {
      const entry = makeEntry();
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      const lines =
        kind === 'unknown'
          ? [{ id: generateUUID() }]
          : [{ id: entry.lines[0].id }, { id: entry.lines[0].id }];
      await expect(usecase(entry.id, { lines })).rejects.toThrow(
        journalEntryError.RectificationLineId
      );
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it('clears only the requested description while preserving the memo and other lines', async () => {
    const entry = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    const response = await usecase(entry.id, {
      lines: [{ id: entry.lines[0].id, description: null }],
    });
    expect(response.memo).toBe(entry.memo);
    expect(response.lines[0].description).toBeNull();
    expect(response.lines[1].description).toBe(entry.lines[1].description);
    expect(mockJournalLineRepo.update).toHaveBeenCalledTimes(1);
    expect(mockJournalLineRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: entry.lines[0].id,
        description: null,
        amount: entry.lines[0].amount,
        functionalAmount: entry.lines[0].functionalAmount,
        accountId: entry.lines[0].accountId,
      }),
      expect.any(Object)
    );
  });

  it('skips persistence for omitted descriptions and normalized equivalent values', async () => {
    const entry = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    for (const payload of [
      { lines: [{ id: entry.lines[0].id }] },
      {
        header: { memo: ` ${entry.memo} ` },
        lines: [
          {
            id: entry.lines[0].id,
            description: ` ${entry.lines[0].description} `,
          },
        ],
      },
    ]) {
      await usecase(entry.id, payload);
    }
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects ineligible journal states through the existing update operation', async () => {
    const entry = makeEntry();
    const [archived] = journalEntryEntity.archive(entry);
    const {
      voided: [voided],
    } = journalEntryEntity.void(entry, entry.createdBy);
    for (const storedEntry of [archived, voided]) {
      mockJournalEntryRepo.findById.mockResolvedValue(storedEntry);
      await expect(usecase(entry.id, {})).rejects.toThrow(
        journalEntryError.RectificationNotPermitted
      );
    }
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it.each(['acquisition', 'header', 'line', 'commit'])(
    'does not publish when the %s write fails',
    async (phase) => {
      const entry = makeEntry();
      const failure = new appError.Conflict();
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      if (phase === 'acquisition') {
        mockRepoService.createTransaction.mockRejectedValueOnce(failure);
      }
      if (phase === 'header') {
        mockJournalEntryRepo.update.mockRejectedValueOnce(failure);
      }
      if (phase === 'line') {
        mockJournalLineRepo.update.mockRejectedValueOnce(failure);
      }
      if (phase === 'commit') {
        mockRepoTransaction.commit.mockRejectedValueOnce(failure);
      }
      await expect(
        usecase(entry.id, {
          lines: [{ id: entry.lines[0].id, description: 'Changed' }],
        })
      ).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      if (phase === 'acquisition') {
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      } else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      }
    }
  );
});
