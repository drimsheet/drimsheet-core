import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import {
  EAccountingPeriodStatus,
  IAccountingPeriod,
} from '@domain/accounting/types/accounting-period.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
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

// Keep real entity behavior by default; allow one contract test to supply a nullable audit.
jest.mock('@domain/journal-entry/entities/journal-entry.entity', () => {
  const actual = jest.requireActual<
    typeof import('@domain/journal-entry/entities/journal-entry.entity')
  >('@domain/journal-entry/entities/journal-entry.entity');
  return { ...actual, __esModule: true, default: { ...actual.default } };
});

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  delete: jest.fn(),
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
};

describe('makeJournalEntryRectificationService', () => {
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const debitAccountId = generateUUID();
  const creditAccountId = generateUUID();
  const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-09-21T09:30:00.000Z');
  const periodRepo: jest.Mocked<IAccountingPeriodRepo> = {
    findAllByFiscalYear: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByDate: jest.fn(),
    findAllByDate: jest.fn(),
    findByRange: jest.fn(),
  };
  const dependencies = {
    ledgerAccountRepo,
    accountingPeriodService: makeAccountingPeriodService({
      accountingPeriodRepo: periodRepo,
    }),
  };
  const service = makeJournalEntryRectificationService(dependencies);
  let periods: IAccountingPeriod[];

  function makePeriods() {
    const [interval] = accountingIntervalEntity.make({
      accountingEntityId,
      createdBy,
      fiscalYearId: generateUUID(),
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      unit: 'month',
      count: 12,
      periods: Array.from({ length: 12 }, (_, index) => ({
        name: `Month ${index + 1}`,
      })),
    });
    return [...interval.periods];
  }

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
    jest.setSystemTime(now);
    periods = makePeriods();
    periodRepo.findAllByDate.mockImplementation(async (entityId, date) => {
      const day = new Date(date.toISOString().slice(0, 10));
      return periods.filter(
        (period) =>
          period.accountingEntityId === entityId &&
          period.startDate <= day &&
          period.endDate > day
      );
    });
    ledgerAccountRepo.findAllByIds.mockResolvedValue([
      makeAccount(debitAccountId),
      makeAccount(creditAccountId),
    ]);
  });

  function makeEntry(posted = false) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.USD, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate,
      postedAt: posted ? effectiveDate : null,
      memo: null,
      createdBy: createdBy,
      functionalCurrency: SYSTEM_CURRENCIES.USD,
      lines: [
        {
          accountId: debitAccountId,
          counterpartyId: null,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
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

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterAll(() => jest.useRealTimers());
  afterEach(() => jest.restoreAllMocks());

  it('rejects a reversal against an archived account without changing the original', async () => {
    const [originalEntry] = makeEntry(true);
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
      originalEntry.accountingEntityId,
      repoOptions
    );
    expect(originalEntry).toEqual(snapshot);
    expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it('exposes the reversal operation', () => {
    expect(Object.keys(service)).toEqual(['reverse']);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it.each([
    ['posted', false],
    ['previously-posted archived', true],
  ])('prepares a balanced reversal for a %s entry', async (_, archived) => {
    const [postedEntry] = makeEntry(true);
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
      effectiveDate: originalEntry.effectiveDate,
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
    expect(result.entryUpdate?.entry).toMatchObject({
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

  it('omits the original-entry update when the void operation returns no audit', async () => {
    const [postedEntry] = makeEntry(true);
    const [originalEntry] = journalEntryEntity.void(postedEntry, {
      voidingEntryId: generateUUID(),
    });
    // The service consumes a nullable transition contract; normal reversal creates a fresh voiding ID.
    const voidOperation = jest
      .spyOn(journalEntryEntity, 'void')
      .mockReturnValueOnce([originalEntry, [], null]);
    const repoOptions = { correlationId: 'unchanged-void-contract' };

    const result = await service.reverse(originalEntry, createdBy, repoOptions);

    expect(voidOperation).toHaveBeenCalledWith(originalEntry, {
      voidingEntryId: result.reversingJournalEntry.id,
    });
    expect(result.originalJournalEntryId).toBe(originalEntry.id);
    expect(result.entryUpdate).toBeNull();
    expect(result.entriesToCreate).toHaveLength(1);
    expect(result.entriesToCreate[0][0]).toBe(result.reversingJournalEntry);
    expect(result.events).toEqual(result.entriesToCreate[0][1]);
    expect(result.events).not.toContainEqual(
      expect.objectContaining({
        type: 'domain:journal-entry:voided',
      })
    );
    expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
  });

  describe('posting periods', () => {
    const correctionTime = new Date('2026-10-01T09:30:00.000Z');
    const repoOptions = { correlationId: 'posting-period-check' };

    beforeEach(() => jest.setSystemTime(correctionTime));

    it('rejects a closed original period without changing the original', async () => {
      const [original] = makeEntry(true);
      const snapshot = structuredClone(original);
      periods[8] = {
        ...periods[8],
        status: EAccountingPeriodStatus.Closed,
        closedAt: correctionTime,
      };

      await expect(
        service.reverse(original, createdBy, repoOptions)
      ).rejects.toBeInstanceOf(periodError.PostingPeriodNotOpen);
      expect(periodRepo.findAllByDate).toHaveBeenCalledWith(
        accountingEntityId,
        original.effectiveDate,
        repoOptions
      );
      expect(original).toEqual(snapshot);
      expect(periodRepo.create).not.toHaveBeenCalled();
    });

    it.each(['uncovered', 'another entity'] as const)(
      'rejects a reversal date with %s coverage',
      async (coverage) => {
        const [original] = makeEntry(true);
        const snapshot = structuredClone(original);
        periods[8] = { ...periods[8], accountingEntityId: generateUUID() };
        if (coverage === 'uncovered') {
          periods.splice(8, 1);
        }

        await expect(
          service.reverse(original, createdBy, repoOptions)
        ).rejects.toBeInstanceOf(periodError.PostingDateNotCovered);
        expect(original).toEqual(snapshot);
      }
    );

    it('rejects ambiguous reversal coverage', async () => {
      const [original] = makeEntry(true);
      periods.push({ ...periods[8], id: generateUUID() });
      await expect(
        service.reverse(original, createdBy, repoOptions)
      ).rejects.toBeInstanceOf(periodError.PostingPeriodAmbiguous);
    });

    it('propagates a period read failure', async () => {
      const [original] = makeEntry(true);
      const failure = new Error('Period read failed');
      periodRepo.findAllByDate.mockRejectedValue(failure);
      await expect(
        service.reverse(original, createdBy, repoOptions)
      ).rejects.toBe(failure);
    });

    it('keeps the reversal posting timestamp when time advances during the read', async () => {
      const [original] = makeEntry(true);
      periodRepo.findAllByDate.mockImplementation(async (_, date) => {
        jest.setSystemTime(new Date('2026-11-01'));
        return [periods[date.getUTCMonth()]];
      });
      const result = await service.reverse(original, createdBy, repoOptions);
      expect(result.reversingJournalEntry).toMatchObject({
        effectiveDate: original.effectiveDate,
        postedAt: correctionTime,
      });
      expect(periodRepo.findAllByDate).toHaveBeenCalledWith(
        accountingEntityId,
        original.effectiveDate,
        repoOptions
      );
    });
  });
});
