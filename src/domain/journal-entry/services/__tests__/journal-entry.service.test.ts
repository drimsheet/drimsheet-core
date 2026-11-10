import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';

import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
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

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  create: jest.fn(),
  delete: jest.fn(),
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

const accountingPeriodService: jest.Mocked<IAccountingPeriodService> = {
  validatePostingPeriod: jest.fn(),
};

describe('journalEntryService.void', () => {
  const service = makeJournalEntryService({
    ledgerAccountRepo,
    accountingPeriodService,
  });
  const accountingEntityId = generateUUID();
  const actorId = generateUUID();
  const effectiveDate = new Date('2026-04-15T00:00:00.000Z');
  const currency = SYSTEM_CURRENCIES.NGN;
  const repoOptions = {
    correlationId: 'void-journal',
    tx: {},
    lock: ERepoLock.Share,
  };
  const accounts = ['100001', '100002'].map(
    (code) =>
      ledgerAccountEntity.make({
        code,
        materializedPath: code,
        accountingEntityId,
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
        behavior: EAssetAccountBehavior.Bank,
        normalBalance: EJournalSide.Debit,
        isControlAccount: false,
        controlAccountId: null,
        name: 'Bank',
        currency,
        status: ELedgerAccountStatus.Active,
        contraAccountRule: EContraAccountRule.ContraPermitted,
        adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
        meta: null,
        createdBy: actorId,
      })[0]
  );
  const [original] = journalEntryEntity.make({
    accountingEntityId,
    sourceType: EJournalEntrySourceType.Payment,
    effectiveDate,
    postedAt: effectiveDate,
    memo: null,
    createdBy: actorId,
    functionalCurrency: currency,
    lines: [EJournalSide.Debit, EJournalSide.Credit].map((side, index) => ({
      accountId: accounts[index].id,
      sequenceOrder: index + 1,
      amount: moneyValue.make(100n, currency, true),
      exchangeRate: null,
      side,
      description: null,
      functionalCurrency: currency,
    })),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    ledgerAccountRepo.findAllByIds.mockResolvedValue(accounts);
  });

  it('returns a linked void and reversal after checking accounts and period', async () => {
    const {
      voided: [voidedEntry],
      reversal,
    } = await service.void(original, actorId, repoOptions);

    expect(reversal?.[0]).toMatchObject({
      sourceType: EJournalEntrySourceType.Reversal,
      status: EJournalEntryStatus.Posted,
      effectiveDate,
    });
    expect(voidedEntry).toMatchObject({
      id: original.id,
      status: EJournalEntryStatus.Voided,
      voidingEntryId: reversal?.[0].id,
    });
    expect(ledgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      accounts.map((account) => account.id),
      accountingEntityId,
      repoOptions
    );
    expect(accountingPeriodService.validatePostingPeriod).toHaveBeenCalledWith(
      accountingEntityId,
      effectiveDate,
      repoOptions
    );
  });

  it('returns an already-voided entry without checking the accounts or period', async () => {
    const {
      voided: [voidedEntry],
    } = journalEntryEntity.void(original, actorId);
    const retry = await service.void(voidedEntry, actorId, repoOptions);

    expect(retry.voided[0]).toBe(voidedEntry);
    expect(retry.reversal).toBeNull();
    expect(ledgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
    expect(
      accountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('rejects a missing referenced account', async () => {
    ledgerAccountRepo.findAllByIds.mockResolvedValue(accounts.slice(1));

    await expect(service.void(original, actorId, repoOptions)).rejects.toThrow(
      journalEntryError.AccountNotFound
    );
  });

  it('rejects an archived referenced account', async () => {
    ledgerAccountRepo.findAllByIds.mockResolvedValue([
      { ...accounts[0], status: ELedgerAccountStatus.Archived },
      accounts[1],
    ]);

    await expect(service.void(original, actorId, repoOptions)).rejects.toThrow(
      journalEntryError.ArchivedLedgerAccountNotAllowed
    );
  });

  it('rejects a reversal in a closed posting period', async () => {
    const error = new periodError.PostingPeriodNotOpen();
    accountingPeriodService.validatePostingPeriod.mockRejectedValue(error);

    await expect(service.void(original, actorId, repoOptions)).rejects.toBe(
      error
    );
  });
});
