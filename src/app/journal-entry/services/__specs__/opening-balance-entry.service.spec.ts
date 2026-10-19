import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { IPettyCashAccount } from '@domain/ledger/types/asset-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import makeOpeningBalanceEntryAppService from '@app/journal-entry/services/opening-balance-entry.service';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';

const [actor] = actorEntity.makeUser({
  email: 'opening-balance-entry@example.com',
  displayName: 'Opening Balance Actor',
});
const [accountingEntity] = accountingEntityEntity.make({
  name: 'Business',
  type: 'private_company',
  ownerId: actor.id,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const equityAccountId = 'd4444444-4444-4444-8444-444444444444' as TEntityId;
const effectiveDate = new Date('2026-03-01T00:00:00.000Z');
const repoOptions = { correlationId: 'opening-balance-entry' };
const openingBalance = {
  amount: { amount: 25_000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  date: effectiveDate,
};

function makeAccount(
  status: 'draft' | 'active' = 'draft',
  currency = SYSTEM_CURRENCIES.NGN
) {
  return ledgerAccountEntity.make<IPettyCashAccount>({
    name: 'Office cash',
    code: '100042',
    materializedPath: '100000.100042',
    accountingEntityId: accountingEntity.id,
    createdBy: actor.id,
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: 'debit',
    isControlAccount: false,
    controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
    currency,
    status,
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
    meta: { lastReconciliationDate: null },
  })[0];
}

function makeOpeningJournal(account: IPettyCashAccount, amount = 10_000n) {
  return journalEntryEntity.make({
    accountingEntityId: accountingEntity.id,
    sourceType: 'opening_balance',
    effectiveDate,
    postedAt: account.status === 'draft' ? null : effectiveDate,
    memo: 'Opening balance',
    createdBy: actor.id,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: account.id,
        sequenceOrder: 1,
        amount: { amount, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'debit',
        description: 'Opening balance',
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: equityAccountId,
        sequenceOrder: 2,
        amount: { amount, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'credit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
    ],
  });
}

function toJournalDetails(entry: ReturnType<typeof makeOpeningJournal>[0]) {
  return {
    ...entry,
    lines: entry.lines.map((line) => ({
      ...line,
      account: { id: line.accountId, name: 'Account' },
      counterparty: null,
    })),
  };
}

function getPayload(account: IPettyCashAccount) {
  return { account, openingBalance, accountingEntity, actor: actor.id };
}

describe('opening balance entry service', () => {
  const service = makeOpeningBalanceEntryAppService({
    journalEntryQueryRepo: mockJournalEntryQueryRepo,
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    fxLotAppService: mockFxLotAppService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockJournalEntryQueryRepo.existsPostedByAccountId.mockResolvedValue(false);
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
      []
    );
    const [equityAccount] = ledgerAccountEntity.make({
      name: 'Opening Balance Equity',
      code: '300001',
      materializedPath: '300001',
      accountingEntityId: accountingEntity.id,
      createdBy: actor.id,
      type: 'equity',
      subType: 'opening_balance',
      behavior: 'opening_balance_equity',
      normalBalance: 'credit',
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.NGN,
      status: 'active',
      contraAccountRule: 'contra_permitted',
      adjunctAccountRule: 'adjunct_permitted',
      meta: null,
    });
    mockLedgerAccountRepo.findBySubType.mockResolvedValue([equityAccount]);
  });

  it('creates an opening-balance entry without selecting an existing mutation', async () => {
    const account = makeAccount('active');

    const result = await service.create(getPayload(account), repoOptions);

    expect(result.creation[0].lines[0].amount.amount).toBe(25_000n);
    expect(result.entriesForBalancePropagation).toEqual([result.creation[0]]);
    expect(
      mockJournalEntryQueryRepo.existsPostedByAccountId
    ).not.toHaveBeenCalled();
    expect(mockJournalEntryQueryRepo.findAll).not.toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      { journalEntry: result.creation[0], account, actor: actor.id },
      repoOptions
    );
  });

  it('rejects creation or revision when the account has historical posted activity', async () => {
    const account = makeAccount();
    mockJournalEntryQueryRepo.existsPostedByAccountId.mockResolvedValue(true);

    await expect(
      service.createOrRevise(getPayload(account), repoOptions)
    ).rejects.toBeInstanceOf(ledgerAccountError.OpeningBalanceLocked);
    expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
  });

  it('passes a balanced differing-precision opening journal to FX acquisition', async () => {
    const account = makeAccount('active', SYSTEM_CURRENCIES.JPY);

    const result = await service.create(
      {
        ...getPayload(account),
        openingBalance: {
          amount: { amount: 150, currencyCode: 'JPY', isMinorUnit: true },
          exchangeRate: {
            baseCurrencyCode: 'JPY',
            targetCurrencyCode: 'NGN',
            rate: 0.006,
            type: 'negotiated',
            asOf: effectiveDate,
            source: 'bank',
          },
          date: effectiveDate,
        },
      },
      repoOptions
    );

    const [entry] = result.creation;
    expect(entry.lines).toHaveLength(2);
    expect(entry.lines[0].amount.amount).toBe(150n);
    expect(entry.lines[0].functionalAmount).toEqual({
      amount: 90n,
      currency: SYSTEM_CURRENCIES.NGN,
    });
    expect(entry.lines[0].side).toBe('debit');
    expect(entry.lines[1].amount).toEqual(entry.lines[0].functionalAmount);
    expect(entry.lines[1].functionalAmount.amount).toBe(90n);
    expect(entry.lines[1].side).toBe('credit');
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      { journalEntry: entry, account, actor: actor.id },
      repoOptions
    );
  });

  it('revises the existing draft while preserving entry and line identity', async () => {
    const account = makeAccount();
    const originalEntry = makeOpeningJournal(account)[0];
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [toJournalDetails(originalEntry)],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await service.createOrRevise(
      getPayload(account),
      repoOptions
    );

    expect(result.currentJournalEntry.id).toBe(originalEntry.id);
    expect(result.currentJournalEntry.lines[0].amount.amount).toBe(25_000n);
    expect(result.mutation).toMatchObject({
      entriesToCreate: [],
      entryUpdate: {
        entry: result.currentJournalEntry,
        expectedVersion: originalEntry.version,
      },
    });
    expect(result.mutation.entryUpdate?.linesToUpdate).toHaveLength(2);
    expect(result.entriesForBalancePropagation).toEqual([]);
  });

  it('returns the unchanged draft without a persistence mutation or events for an identical revision', async () => {
    const account = makeAccount();
    const payload = getPayload(account);
    const { creation } = await service.create(payload, repoOptions);
    const originalEntry = toJournalDetails(creation[0]);
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [originalEntry],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await service.createOrRevise(payload, repoOptions);

    expect(result.currentJournalEntry).toBe(originalEntry);
    expect(result.currentJournalEntry.version).toBe(originalEntry.version);
    expect(result.currentJournalEntry.updatedAt).toBe(originalEntry.updatedAt);
    expect(result.currentJournalEntry.lines).toBe(originalEntry.lines);
    expect(result.mutation).toEqual({
      entriesToCreate: [],
      entryUpdate: null,
      events: [],
    });
    expect(result.entriesForBalancePropagation).toEqual([]);
    expect(result.fxAcquisition).toBeNull();
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).toHaveBeenCalledWith(accountingEntity.id, effectiveDate, repoOptions);
  });

  it('creates a posted entry when no draft exists and returns its FX and propagation effects', async () => {
    const account = makeAccount('active');
    const fxAcquisition = { records: {}, events: [] } as unknown as Awaited<
      ReturnType<typeof mockFxLotAppService.acquire>
    >;
    mockFxLotAppService.acquire.mockResolvedValue(fxAcquisition);

    const result = await service.createOrRevise(
      getPayload(account),
      repoOptions
    );

    expect(result.mutation.entriesToCreate[0][0]).toBe(
      result.currentJournalEntry
    );
    expect(result.fxAcquisition).toBe(fxAcquisition);
    expect(result.entriesForBalancePropagation).toEqual([
      result.currentJournalEntry,
    ]);
  });
});
