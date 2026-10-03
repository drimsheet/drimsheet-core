import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { IRepoOptions, ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import {
  IJournalEntryHistory,
  IJournalLineHistory,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

import {
  mockJournalEntryAttachmentRepo,
  mockJournalEntryHistoryRepo,
  mockJournalEntryRepo,
  mockJournalLineHistoryRepo,
  mockJournalLineRepo,
} from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeJournalEntryPersistenceService from '@app/journal-entry/services/journal-entry-persistence.service';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

describe('journalEntryPersistenceService', () => {
  const service = makeJournalEntryPersistenceService({
    repoService: mockRepoService,
    journalEntryAttachmentRepo: mockJournalEntryAttachmentRepo,
    journalEntryHistoryRepo: mockJournalEntryHistoryRepo,
    journalEntryRepo: mockJournalEntryRepo,
    journalLineHistoryRepo: mockJournalLineHistoryRepo,
    journalLineRepo: mockJournalLineRepo,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  const equityAccountService = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  const mockOptions: IRepoOptions = {
    correlationId: 'test-correlation-id',
  };

  const jurisdictionCode: keyof typeof SYSTEM_JURISDICTIONS = 'NG';
  const timestamp = new Date('2026-06-15T10:30:00.000Z');
  const attachments: IFileAttachment[] = [
    {
      url: 'https://files.example.com/receipt.pdf',
      name: 'receipt.pdf',
      type: 'application/pdf',
      size: 1024,
    },
  ];

  async function makeFixture(entryAttachments: IFileAttachment[] = []) {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'journal.persistence@example.com',
      emailVerified: true,
      firstName: 'Journal',
      lastName: 'Persistence',
    });

    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Journal Persistence LLC',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: user.id,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode,
    });

    const [controlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash and Cash Equivalents',
        accountingEntity,
        createdBy: user.actorId,
      },
      mockOptions
    );

    const [cashAccount] = ((
      payload: Omit<
        Parameters<typeof cashAccountService.createPettyCashSubAccount>[0],
        'controlAccountId'
      > & { controlAccount: ILedgerAccount }
    ) => {
      const controlAccount = payload.controlAccount;
      const code = String(Number(controlAccount.code) + 1).padStart(6, '0');
      const materializedPath = controlAccount.materializedPath + '.' + code;
      return ledgerAccountEntity.make<ILedgerAccount>({
        name: payload.name,
        accountingEntityId: payload.accountingEntity.id,
        code,
        materializedPath,
        normalBalance: 'debit',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'petty_cash',
        isControlAccount: payload.isControlAccount,
        controlAccountId: controlAccount.id,
        currency: payload.currency,
        meta: null,
        status: 'active',
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        createdBy: payload.createdBy,
      }) as Awaited<
        ReturnType<typeof cashAccountService.createPettyCashSubAccount>
      >;
    })({
      name: 'Main Petty Cash',
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      controlAccount,
      accountingEntity,
      createdBy: user.actorId,
    });

    const [equityAccount] =
      await equityAccountService.createOpeningBalanceAccount(
        {
          name: 'Opening Balance Equity',
          createdBy: user.actorId,
          accountingEntity,
        },
        mockOptions
      );

    const amount = moneyValue.make(100000n, SYSTEM_CURRENCIES.NGN, true);
    const [journalEntry, , audit] = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: timestamp,
      postedAt: timestamp,
      memo: 'Opening balance',
      createdBy: user.actorId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments: entryAttachments,
      lines: [
        {
          accountId: cashAccount.id,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
          amount,
          exchangeRate: null,
          sequenceOrder: 1,
          side: EJournalSide.Debit,
          description: 'Opening balance',
        },
        {
          accountId: equityAccount.id,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
          amount,
          exchangeRate: null,
          sequenceOrder: 2,
          side: EJournalSide.Credit,
          description: 'Opening balance',
        },
      ],
    });

    const actor = user.id;
    const headerHistory: IJournalEntryHistory = {
      ...audit.header,
      actorId: actor,
      onBehalfOf: null,
      correlationId: mockOptions.correlationId,
    };
    const linesHistory: IJournalLineHistory[] = audit.lines.map(
      (lineAudit) => ({
        ...lineAudit,
        actorId: actor,
        onBehalfOf: null,
        correlationId: mockOptions.correlationId,
      })
    );

    return {
      headerHistory,
      journalEntry,
      linesHistory,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    mockJournalEntryRepo.create.mockResolvedValue(undefined);
    mockJournalEntryRepo.delete.mockResolvedValue(undefined);
    mockJournalEntryAttachmentRepo.save.mockResolvedValue(undefined);
    mockJournalEntryHistoryRepo.deleteByJournalEntryId.mockResolvedValue(
      undefined
    );
    mockJournalLineHistoryRepo.deleteByJournalEntryId.mockResolvedValue(
      undefined
    );
    mockJournalLineRepo.create.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('should persist the journal entry header, lines, and attachments in a transaction', async () => {
      const { headerHistory, journalEntry, linesHistory } =
        await makeFixture(attachments);
      const { lines, attachments: entryAttachments, ...header } = journalEntry;

      await service.create(
        journalEntry,
        headerHistory,
        linesHistory,
        mockOptions
      );

      expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryRepo.create).toHaveBeenCalledWith(header, {
        ...mockOptions,
        tx: expect.anything(),
        history: headerHistory,
      });
      expect(mockJournalLineRepo.create).toHaveBeenCalledWith(lines, {
        ...mockOptions,
        tx: expect.anything(),
        history: linesHistory,
        accountingEntityId: journalEntry.accountingEntityId,
      });
      expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledWith(
        journalEntry.id,
        entryAttachments,
        {
          ...mockOptions,
          tx: expect.anything(),
        }
      );
    });

    it('should not save attachments when the journal entry has none', async () => {
      const { headerHistory, journalEntry, linesHistory } = await makeFixture();

      await service.create(
        journalEntry,
        headerHistory,
        linesHistory,
        mockOptions
      );

      expect(mockJournalEntryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalLineRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryAttachmentRepo.save).not.toHaveBeenCalled();
    });

    it('should stop before creating lines if header persistence fails', async () => {
      const { headerHistory, journalEntry, linesHistory } = await makeFixture();
      const error = new Error('header persistence failed');

      mockJournalEntryRepo.create.mockRejectedValue(error);

      await expect(
        service.create(journalEntry, headerHistory, linesHistory, mockOptions)
      ).rejects.toThrow(error);

      expect(mockJournalEntryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalLineRepo.create).not.toHaveBeenCalled();
      expect(mockJournalEntryAttachmentRepo.save).not.toHaveBeenCalled();
    });

    it('should fail if line persistence fails', async () => {
      const { headerHistory, journalEntry, linesHistory } = await makeFixture();
      const error = new Error('line persistence failed');

      mockJournalLineRepo.create.mockRejectedValue(error);

      await expect(
        service.create(journalEntry, headerHistory, linesHistory, mockOptions)
      ).rejects.toThrow(error);

      expect(mockJournalEntryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalLineRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryAttachmentRepo.save).not.toHaveBeenCalled();
    });

    it('should fail if attachment persistence fails', async () => {
      const { headerHistory, journalEntry, linesHistory } =
        await makeFixture(attachments);
      const error = new Error('attachment persistence failed');
      mockJournalEntryAttachmentRepo.save.mockRejectedValue(error);

      await expect(
        service.create(journalEntry, headerHistory, linesHistory, mockOptions)
      ).rejects.toThrow(error);

      expect(mockJournalEntryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalLineRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('rectify', () => {
    it('saves attachments for entries created during rectification', async () => {
      const { headerHistory, journalEntry, linesHistory } =
        await makeFixture(attachments);

      await service.rectify(
        {
          entriesToCreate: [
            {
              entry: journalEntry,
              headerHistory,
              lineHistories: linesHistory,
            },
          ],
          entryUpdate: null,
        },
        mockOptions
      );

      expect(mockJournalEntryAttachmentRepo.save).toHaveBeenCalledWith(
        journalEntry.id,
        journalEntry.attachments,
        expect.objectContaining({ tx: 'mock-tx' })
      );
    });

    it('skips attachments for created entries without attachments', async () => {
      const { headerHistory, journalEntry, linesHistory } = await makeFixture();

      await service.rectify(
        {
          entriesToCreate: [
            {
              entry: journalEntry,
              headerHistory,
              lineHistories: linesHistory,
            },
          ],
          entryUpdate: null,
        },
        mockOptions
      );

      expect(mockJournalEntryAttachmentRepo.save).not.toHaveBeenCalled();
    });

    it('persists prepared journal entries before a lineage update in one transaction', async () => {
      const { headerHistory, journalEntry, linesHistory } =
        await makeFixture(attachments);
      const updatedEntry = {
        ...journalEntry,
        version: journalEntry.version + 1,
      };

      await service.rectify(
        {
          entriesToCreate: [
            {
              entry: journalEntry,
              headerHistory,
              lineHistories: linesHistory,
            },
          ],
          entryUpdate: {
            entry: updatedEntry,
            expectedVersion: journalEntry.version,
            headerHistory: {
              ...headerHistory,
              entityVersion: updatedEntry.version,
            },
            lineHistories: [],
            linesToCreate: [],
            linesToUpdate: [],
            lineIdsToDelete: [],
          },
        },
        {
          ...mockOptions,
          tx: 'caller-tx' as unknown as ITransactionContext,
        }
      );

      expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        'caller-tx'
      );
      expect(mockJournalEntryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: updatedEntry.id,
          version: updatedEntry.version,
        }),
        expect.objectContaining({
          expectedVersion: journalEntry.version,
          tx: 'mock-tx',
        })
      );
      expect(
        mockJournalEntryRepo.create.mock.invocationCallOrder[0]
      ).toBeLessThan(mockJournalEntryRepo.update.mock.invocationCallOrder[0]);
      expect(mockJournalEntryAttachmentRepo.save).toHaveBeenLastCalledWith(
        updatedEntry.id,
        updatedEntry.attachments,
        expect.objectContaining({ tx: 'mock-tx' })
      );
    });

    it('persists prepared line additions, updates, and removals', async () => {
      const { headerHistory, journalEntry, linesHistory } = await makeFixture();
      const [firstLine, secondLine] = journalEntry.lines;
      const updatedLine = {
        ...firstLine,
        description: 'Updated description',
        version: firstLine.version + 1,
      };
      const createdLine = {
        ...secondLine,
        id: journalEntry.lines[0].id,
      };
      const updatedEntry = {
        ...journalEntry,
        lines: [updatedLine, createdLine],
        version: journalEntry.version + 1,
      };

      await service.rectify(
        {
          entriesToCreate: [],
          entryUpdate: {
            entry: updatedEntry,
            expectedVersion: journalEntry.version,
            headerHistory: {
              ...headerHistory,
              entityVersion: updatedEntry.version,
            },
            lineHistories: [
              { ...linesHistory[0], entityVersion: updatedLine.version },
              linesHistory[1],
            ],
            linesToCreate: [createdLine],
            linesToUpdate: [updatedLine],
            lineIdsToDelete: [secondLine.id],
          },
        },
        mockOptions
      );

      expect(mockJournalLineRepo.delete).toHaveBeenCalledWith(
        [secondLine.id],
        expect.objectContaining({ tx: 'mock-tx' })
      );
      expect(mockJournalLineRepo.create).toHaveBeenCalledWith(
        [createdLine],
        expect.objectContaining({ tx: 'mock-tx' })
      );
      expect(mockJournalLineRepo.update).toHaveBeenCalledWith(
        updatedLine,
        expect.objectContaining({
          tx: 'mock-tx',
          expectedVersion: firstLine.version,
        })
      );
    });
  });

  describe('delete', () => {
    it('deletes histories before the versioned header in one transaction', async () => {
      const { journalEntry } = await makeFixture();

      await service.delete(
        {
          journalEntryId: journalEntry.id,
          expectedVersion: journalEntry.version,
        },
        {
          ...mockOptions,
          tx: 'caller-tx' as unknown as ITransactionContext,
        }
      );

      expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        'caller-tx'
      );
      expect(
        mockJournalLineHistoryRepo.deleteByJournalEntryId
      ).toHaveBeenCalledWith(
        journalEntry.id,
        expect.objectContaining({ tx: 'mock-tx' })
      );
      expect(
        mockJournalEntryHistoryRepo.deleteByJournalEntryId
      ).toHaveBeenCalledWith(
        journalEntry.id,
        expect.objectContaining({ tx: 'mock-tx' })
      );
      expect(mockJournalEntryRepo.delete).toHaveBeenCalledWith(
        journalEntry.id,
        expect.objectContaining({
          tx: 'mock-tx',
          expectedVersion: journalEntry.version,
        })
      );
      expect(
        mockJournalLineHistoryRepo.deleteByJournalEntryId.mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        mockJournalEntryHistoryRepo.deleteByJournalEntryId.mock
          .invocationCallOrder[0]
      );
      expect(
        mockJournalEntryHistoryRepo.deleteByJournalEntryId.mock
          .invocationCallOrder[0]
      ).toBeLessThan(mockJournalEntryRepo.delete.mock.invocationCallOrder[0]);
    });

    it('stops before deleting the header when history deletion fails', async () => {
      const { journalEntry } = await makeFixture();
      const failure = new Error('history deletion failed');
      mockJournalEntryHistoryRepo.deleteByJournalEntryId.mockRejectedValueOnce(
        failure
      );

      await expect(
        service.delete(
          {
            journalEntryId: journalEntry.id,
            expectedVersion: journalEntry.version,
          },
          mockOptions
        )
      ).rejects.toBe(failure);

      expect(mockJournalEntryRepo.delete).not.toHaveBeenCalled();
    });

    it('propagates a versioned header deletion failure', async () => {
      const { journalEntry } = await makeFixture();
      const failure = new Error('stale version');
      mockJournalEntryRepo.delete.mockRejectedValueOnce(failure);

      await expect(
        service.delete(
          {
            journalEntryId: journalEntry.id,
            expectedVersion: journalEntry.version,
          },
          mockOptions
        )
      ).rejects.toBe(failure);
    });
  });
});
