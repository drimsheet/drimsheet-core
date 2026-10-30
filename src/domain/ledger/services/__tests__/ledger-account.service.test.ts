import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeLedgerAccountService from '@domain/ledger/services/ledger-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

const mockLedgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
  findAllByAccountingEntityId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustBalance: jest.fn(),
  findByAccountId: jest.fn(),
  findAdjustmentsByAccountId: jest.fn(),
  createWithAdjustments: jest.fn(),
  findAllByAccountIds: jest.fn(),
};
const accountingEntityId = generateUUID();
const createdBy = generateUUID();
function account(
  code: string,
  materializedPath: string,
  status: ILedgerAccount['status'] = 'active',
  isControlAccount = false
): ILedgerAccount {
  return ledgerAccountEntity.make({
    code,
    materializedPath,
    status,
    isControlAccount,
    accountingEntityId,
    createdBy,
    name: 'Archive account',
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: 'debit',
    controlAccountId: materializedPath === code ? null : generateUUID(),
    currency: null,
    meta: null,
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
  })[0];
}
const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  delete: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findDescendants: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
};
const mockJournalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
  existsByAccountingEntityId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  existsByAccountId: jest.fn(),
  existsPostedByAccountId: jest.fn(),
  findAllByAccountIds: jest.fn(),
};
const service = makeLedgerAccountService({
  ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  journalEntryRepo: mockJournalEntryRepo,
  ledgerAccountRepo: mockLedgerAccountRepo,
});
const repoOptions = { correlationId: 'archive', tx: {} };

describe('ledgerAccountService.canUpdateCurrency', () => {
  const options = { correlationId: 'currency-eligibility' };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each(['liability', 'equity', 'revenue', 'expense'] as const)(
    'rejects %s accounts without reading journals',
    async (type) => {
      const [target] = ledgerAccountEntity.make({
        ...account('100001', '100000.100001'),
        type,
      });
      await expect(service.canUpdateCurrency(target, options)).resolves.toEqual(
        {
          canUpdateCurrency: false,
          reason: 'not_asset_account',
        }
      );
      expect(
        mockJournalEntryRepo.existsPostedByAccountId
      ).not.toHaveBeenCalled();
    }
  );

  describe.each(['draft', 'active', 'archived'] as const)(
    '%s asset',
    (status) => {
      it.each([false, true])(
        'checks historical posting activity=%s without treating account status as eligibility',
        async (hasPostedJournalEntries) => {
          const target = account('100001', '100000.100001', status);
          mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValue(
            hasPostedJournalEntries
          );

          await expect(
            service.canUpdateCurrency(target, options)
          ).resolves.toEqual(
            hasPostedJournalEntries
              ? {
                  canUpdateCurrency: false,
                  reason: 'has_posted_journal_entries',
                }
              : { canUpdateCurrency: true }
          );
          expect(
            mockJournalEntryRepo.existsPostedByAccountId
          ).toHaveBeenCalledWith(target.id, accountingEntityId, options);
          expect(mockJournalEntryRepo.existsByAccountId).not.toHaveBeenCalled();
        }
      );
    }
  );

  it('allows asset headers and controls with no direct posting activity', async () => {
    mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValue(false);
    const target = account('100000', '100000', 'active', true);
    await expect(service.canUpdateCurrency(target, options)).resolves.toEqual({
      canUpdateCurrency: true,
    });
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
  });

  it('propagates posting query failures', async () => {
    const failure = new Error('posting query failed');
    mockJournalEntryRepo.existsPostedByAccountId.mockRejectedValue(failure);
    await expect(
      service.canUpdateCurrency(account('100001', '100000.100001'), options)
    ).rejects.toBe(failure);
  });
});

describe('ledgerAccountService.canDelete', () => {
  const options = { correlationId: 'eligibility' };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.delete).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.findAllByAccountIds).not.toHaveBeenCalled();
  });

  describe.each(['draft', 'active', 'archived'] as const)(
    '%s account',
    (status) => {
      it.each([true, false])(
        'rejects a header with isControlAccount=%s without reading journals',
        async (isControlAccount) => {
          const header = account('100000', '100000', status, isControlAccount);

          await expect(service.canDelete(header, options)).resolves.toEqual({
            canDelete: false,
            reason: 'header_account',
          });
          expect(mockJournalEntryRepo.existsByAccountId).not.toHaveBeenCalled();
        }
      );

      describe.each([true, false])(
        'isControlAccount=%s',
        (isControlAccount) => {
          it.each([true, false])(
            'checks eligibility when hasJournalEntries=%s',
            async (hasJournalEntries) => {
              const target = account(
                '100001',
                '100000.100001',
                status,
                isControlAccount
              );
              mockJournalEntryRepo.existsByAccountId.mockResolvedValue(
                hasJournalEntries
              );

              const expectedEligibility =
                status === 'draft' || !hasJournalEntries
                  ? { canDelete: true }
                  : { canDelete: false, reason: 'has_journal_entries' };
              await expect(service.canDelete(target, options)).resolves.toEqual(
                expectedEligibility
              );

              if (status === 'draft') {
                expect(
                  mockJournalEntryRepo.existsByAccountId
                ).not.toHaveBeenCalled();
              } else {
                expect(
                  mockJournalEntryRepo.existsByAccountId
                ).toHaveBeenCalledWith(target.id, accountingEntityId, options);
              }
            }
          );
        }
      );
    }
  );

  it('propagates journal reference query failures', async () => {
    const failure = new Error('query failed');
    mockJournalEntryRepo.existsByAccountId.mockRejectedValue(failure);

    await expect(
      service.canDelete(account('100001', '100000.100001'), options)
    ).rejects.toBe(failure);
  });
});

describe('ledgerAccountService.archive', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([]);
    mockLedgerAccountRepo.findById.mockResolvedValue(
      account('100000', '100000', 'active', true)
    );
  });

  afterEach(() => {
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each(['active', 'draft'] as const)(
    'archives a supplied %s leaf without fetching descendants',
    async (status) => {
      const target = account('100001', '100000.100001', status);
      const result = await service.archive(target, repoOptions);
      expect(result).toHaveLength(1);
      const [archived, events, audit] = result[0];
      expect(archived).toMatchObject({
        id: target.id,
        status: 'archived',
        version: target.version + 1,
        materializedPath: target.materializedPath,
        controlAccountId: target.controlAccountId,
        deletedAt: target.deletedAt,
      });
      expect(Object.isFrozen(archived)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe(archived);
      expect(audit).toMatchObject({
        action: 'archived',
        entityId: target.id,
      });
      expect(target.status).toBe(status);
      expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
    }
  );

  it('retrieves the complete nested subtree and returns only changed accounts target-first', async () => {
    const target = account('100001', '100000.100001', 'active', true);
    const child = account('100002', '100000.100001.100002', 'active', true);
    const leaf = account('100003', '100000.100001.100002.100003', 'draft');
    const archived = account('100004', '100000.100001.100004', 'archived');
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([
      child,
      leaf,
      archived,
    ]);

    const result = await service.archive(target, repoOptions);

    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledWith(
      accountingEntityId,
      target.materializedPath,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledTimes(1);
    expect(result.map(([account]) => account.id)).toEqual([
      target.id,
      child.id,
      leaf.id,
    ]);
    for (const [archivedAccount, events, audit] of result) {
      expect(archivedAccount.status).toBe('archived');
      expect(archivedAccount.version).toBe(2);
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe(archivedAccount);
      expect(audit).toMatchObject({
        action: 'archived',
        entityId: archivedAccount.id,
      });
    }
    expect(archived.version).toBe(1);
  });

  it('archives a control with no descendants', async () => {
    const target = account('100001', '100000.100001', 'active', true);
    await expect(service.archive(target, repoOptions)).resolves.toHaveLength(1);
    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledTimes(1);
  });

  it('returns no changes for an already archived control without querying descendants', async () => {
    const target = account('100001', '100000.100001', 'archived', true);
    await expect(service.archive(target, repoOptions)).resolves.toEqual([]);
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
  });

  it.each(['active', 'draft', 'archived'] as const)(
    'rejects a %s header before any descendant query',
    async (status) => {
      const header = account('100000', '100000', status, true);
      await expect(service.archive(header, repoOptions)).rejects.toBeInstanceOf(
        ledgerAccountError.HeaderAccountNotArchivable
      );
      expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
      expect(header.status).toBe(status);
      expect(header.version).toBe(1);
    }
  );

  it('propagates descendant lookup failures without persistence', async () => {
    const target = account('100001', '100000.100001', 'active', true);
    const failure = new Error('descendant lookup failed');
    mockLedgerAccountRepo.findDescendants.mockRejectedValueOnce(failure);
    await expect(service.archive(target, repoOptions)).rejects.toBe(failure);
    expect(target.status).toBe('active');
  });
  it.each(['draft', 'active'] as const)(
    'rejects archiving a %s child of a draft control',
    async (status) => {
      const parent = account('100001', '100000.100001', 'draft', true);
      const target = account('100002', '100000.100001.100002', status);
      mockLedgerAccountRepo.findById.mockResolvedValue(parent);
      await expect(service.archive(target, repoOptions)).rejects.toBeInstanceOf(
        ledgerAccountError.NonDraftChildOfDraftControlAccount
      );
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        target.controlAccountId,
        accountingEntityId,
        repoOptions
      );
      expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
    }
  );

  it('allows archiving a whole draft subtree under an active parent', async () => {
    const target = account('100001', '100000.100001', 'draft', true);
    const child = account('100002', '100000.100001.100002', 'draft');
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([child]);
    const archived = await service.archive(target, repoOptions);
    expect(archived.map(([candidate]) => candidate.status)).toEqual([
      'archived',
      'archived',
    ]);
  });

  it('rejects when the parent cannot be found', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(
      service.archive(account('100001', '100000.100001'), repoOptions)
    ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
  });
});

describe('ledgerAccountService.getNextCode', () => {
  const service = makeLedgerAccountService({
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    journalEntryRepo: mockJournalEntryRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const [header] = ledgerAccountEntity.make({
    name: 'Cash header',
    code: '100000',
    materializedPath: '100000',
    accountingEntityId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'default_cash',
    normalBalance: 'debit',
    isControlAccount: true,
    controlAccountId: null,
    currency: SYSTEM_CURRENCIES.NGN,
    meta: null,
    status: 'active',
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
  });
  const payload = {
    accountingEntityId: header.accountingEntityId,
    type: header.type,
    subType: header.subType,
    allocationHeaderCode: header.code,
  };
  const options = { correlationId: 'allocation', tx: {} };
  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue({
      id: header.id,
      code: '100041',
      materializedPath: '100000.100041',
    });
  });
  it('selects the next family code without reserving or writing it', async () => {
    await expect(service.getNextCode(payload, options)).resolves.toBe('100042');
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      header.accountingEntityId,
      header.type,
      header.subType,
      options
    );
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
  });
  it('falls back to the header when no latest account exists', async () => {
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
    await expect(service.getNextCode(payload, options)).resolves.toBe('100001');
  });
  it('rejects a missing transaction before reading', async () => {
    await expect(
      // @ts-expect-error Exercise runtime contract.
      service.getNextCode(payload, { correlationId: 'allocation' })
    ).rejects.toBeInstanceOf(
      ledgerAccountError.CodeAllocationTransactionRequired
    );
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });
  it.each(['100999', '200001'])(
    'preserves predecessor restrictions: %s',
    async (code) => {
      mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue({
        id: header.id,
        code,
        materializedPath: code,
      });
      await expect(
        service.getNextCode(payload, options)
      ).rejects.toBeInstanceOf(
        code === '100999'
          ? ledgerAccountError.MaximumLimitReached
          : ledgerAccountError.InvalidPredecessorCode
      );
    }
  );
  it('propagates predecessor lookup failure', async () => {
    const failure = new Error('database unavailable');
    mockLedgerAccountRepo.findLatestBySubType.mockRejectedValue(failure);
    await expect(service.getNextCode(payload, options)).rejects.toBe(failure);
  });
});

describe('ledgerAccountService.delete', () => {
  const [target] = ledgerAccountEntity.make({
    accountingEntityId: generateUUID(),
    createdBy: generateUUID(),
    code: '100001',
    materializedPath: '100000.100001',
    name: 'Draft cash control',
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'default_cash',
    normalBalance: 'debit',
    isControlAccount: true,
    controlAccountId: generateUUID(),
    currency: null,
    status: 'draft',
    meta: null,
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
  });
  const [child] = ledgerAccountEntity.make({
    ...target,
    code: '100002',
    materializedPath: '100000.100001.100002',
    controlAccountId: target.id,
  });
  const [leaf] = ledgerAccountEntity.make({
    ...child,
    code: '100003',
    materializedPath: '100000.100001.100002.100003',
    controlAccountId: child.id,
    isControlAccount: false,
  });
  const options = { correlationId: 'delete', tx: {}, lock: 'update' as const };
  const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);
  const [draftEntry] = journalEntryEntity.make({
    accountingEntityId: target.accountingEntityId,
    sourceType: 'payment',
    effectiveDate: new Date('2026-01-01'),
    postedAt: null,
    memo: null,
    createdBy: target.createdBy,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: leaf.id,
        sequenceOrder: 1,
        amount,
        exchangeRate: null,
        side: 'debit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: generateUUID(),
        sequenceOrder: 2,
        amount,
        exchangeRate: null,
        side: 'credit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
    ],
  });
  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([child, leaf]);
    mockJournalEntryRepo.findAllByAccountIds.mockResolvedValue([draftEntry]);
  });
  afterEach(() => {
    expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['draft', true],
    ['draft', false],
    ['active', true],
    ['active', false],
    ['archived', true],
    ['archived', false],
  ] as const)(
    'rejects a parentless %s account with isControlAccount=%s before any reads',
    async (status, isControlAccount) => {
      const [header] = ledgerAccountEntity.make({
        ...target,
        code: '100000',
        materializedPath: '100000',
        controlAccountId: null,
        status,
        isControlAccount,
      });

      await expect(service.delete(header, options)).rejects.toMatchObject({
        errorKey: 'ledger_error_header_account_delete_invalid',
      });
      expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
      expect(mockJournalEntryRepo.findAllByAccountIds).not.toHaveBeenCalled();
    }
  );

  it('prepares the complete subtree child-first and keeps the authoritative journal version', async () => {
    const removal = await service.delete(target, options);
    expect(removal.accounts).toEqual(
      [leaf, child, target].map((account) => [
        account,
        expect.objectContaining({
          type: 'domain:ledger:account:deleted',
          data: account,
        }),
        null,
      ])
    );
    for (const deletion of removal.accounts) {
      const [account, event] = deletion;
      expect(event.data).toBe(account);
      expect(Object.isFrozen(event)).toBe(true);
    }
    expect(removal.journalEntries).toEqual([draftEntry]);
    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledWith(
      target.accountingEntityId,
      target.materializedPath,
      options
    );
    expect(mockJournalEntryRepo.findAllByAccountIds).toHaveBeenCalledWith(
      [target.id, child.id, leaf.id],
      target.accountingEntityId,
      options
    );
  });

  it('does not query descendants for a posting account', async () => {
    expect((await service.delete(leaf, options)).accounts).toEqual([
      [
        leaf,
        expect.objectContaining({
          type: 'domain:ledger:account:deleted',
          data: leaf,
        }),
        null,
      ],
    ]);
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
  });

  it('allows an empty draft control and an account without entries', async () => {
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([]);
    mockJournalEntryRepo.findAllByAccountIds.mockResolvedValue([]);
    expect(await service.delete(target, options)).toEqual({
      accounts: [
        [
          target,
          expect.objectContaining({
            type: 'domain:ledger:account:deleted',
            data: target,
          }),
          null,
        ],
      ],
      journalEntries: [],
    });
  });

  it.each(['active', 'archived'] as const)(
    'rejects a %s target with journal references before preparing the subtree',
    async (status) => {
      const [account] = ledgerAccountEntity.make({ ...target, status });
      mockJournalEntryRepo.existsByAccountId.mockResolvedValue(true);
      await expect(service.delete(account, options)).rejects.toBeInstanceOf(
        ledgerAccountError.NonDraftAccountDeletion
      );
      expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenCalledWith(
        account.id,
        account.accountingEntityId,
        options
      );
      expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
      expect(mockJournalEntryRepo.findAllByAccountIds).not.toHaveBeenCalled();
    }
  );

  it.each(['active', 'archived'] as const)(
    'rejects the entire subtree for a %s descendant with journal references',
    async (status) => {
      const [account] = ledgerAccountEntity.make({ ...leaf, status });
      mockLedgerAccountRepo.findDescendants.mockResolvedValue([child, account]);
      mockJournalEntryRepo.existsByAccountId.mockResolvedValue(true);
      await expect(service.delete(target, options)).rejects.toBeInstanceOf(
        ledgerAccountError.NonDraftAccountDeletion
      );
      expect(mockJournalEntryRepo.findAllByAccountIds).not.toHaveBeenCalled();
      expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenCalledWith(
        account.id,
        account.accountingEntityId,
        options
      );
    }
  );

  it.each(['active', 'archived'] as const)(
    'allows a %s posting account without journal references',
    async (status) => {
      const [account] = ledgerAccountEntity.make({ ...leaf, status });
      mockJournalEntryRepo.existsByAccountId.mockResolvedValue(false);
      mockJournalEntryRepo.findAllByAccountIds.mockResolvedValue([]);

      await expect(service.delete(account, options)).resolves.toEqual({
        accounts: [
          [
            account,
            expect.objectContaining({
              type: 'domain:ledger:account:deleted',
              data: account,
            }),
            null,
          ],
        ],
        journalEntries: [],
      });
      expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenCalledWith(
        account.id,
        account.accountingEntityId,
        options
      );
    }
  );

  it('allows unreferenced non-draft controls and descendants alongside a draft posting account', async () => {
    const [activeTarget] = ledgerAccountEntity.make({
      ...target,
      status: 'active',
    });
    const [archivedChild] = ledgerAccountEntity.make({
      ...child,
      status: 'archived',
    });
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([
      archivedChild,
      leaf,
    ]);
    mockJournalEntryRepo.existsByAccountId.mockResolvedValue(false);

    await expect(service.delete(activeTarget, options)).resolves.toEqual({
      accounts: [leaf, archivedChild, activeTarget].map((account) => [
        account,
        expect.objectContaining({
          type: 'domain:ledger:account:deleted',
          data: account,
        }),
        null,
      ]),
      journalEntries: [draftEntry],
    });
    expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenCalledTimes(2);
    expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenNthCalledWith(
      1,
      activeTarget.id,
      activeTarget.accountingEntityId,
      options
    );
    expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenNthCalledWith(
      2,
      archivedChild.id,
      archivedChild.accountingEntityId,
      options
    );
  });

  it('propagates eligibility query failures before preparing journal deletion', async () => {
    const [account] = ledgerAccountEntity.make({ ...leaf, status: 'active' });
    const failure = new Error('journal reference query failed');
    mockJournalEntryRepo.existsByAccountId.mockRejectedValue(failure);

    await expect(service.delete(account, options)).rejects.toBe(failure);
    expect(mockJournalEntryRepo.findAllByAccountIds).not.toHaveBeenCalled();
  });

  it.each<IJournalEntry>([
    { ...draftEntry, status: 'posted', postedAt: new Date('2026-01-01') },
    { ...draftEntry, status: 'voided', postedAt: new Date('2026-01-01') },
    { ...draftEntry, status: 'archived', postedAt: new Date('2026-01-01') },
    { ...draftEntry, status: 'archived' },
    { ...draftEntry, postedAt: new Date('2026-01-01') },
    { ...draftEntry, status: 'posted' },
    { ...draftEntry, status: 'voided' },
    { ...draftEntry, sourceType: 'reversal' },
  ])(
    'rejects an invalid draft journal as an unexpected invariant violation: %p',
    async (entry) => {
      mockJournalEntryRepo.findAllByAccountIds.mockResolvedValue([
        draftEntry,
        entry,
      ]);
      await expect(service.delete(target, options)).rejects.toMatchObject({
        errorKey: 'ledger_error_draft_account_journal_entry_unexpected',
      });
    }
  );

  it('includes all descendants beyond a page boundary', async () => {
    const descendants = Array.from({ length: 60 }, (_, index) => {
      const code = `100${String(index + 2).padStart(3, '0')}`;
      return ledgerAccountEntity.make({
        ...leaf,
        code,
        materializedPath: `${target.materializedPath}.${code}`,
      })[0];
    });
    mockLedgerAccountRepo.findDescendants.mockResolvedValue(descendants);
    expect((await service.delete(target, options)).accounts).toHaveLength(61);
  });
});

describe('ledgerAccountService.validateCurrencyChange', () => {
  const cash = ledgerAccountEntity.update(account('100001', '100000.100001'), {
    currency: SYSTEM_CURRENCIES.NGN,
  })[0];
  const header = account('100000', '100000', 'active', true);
  beforeEach(() => {
    jest.resetAllMocks();
    mockJournalEntryRepo.existsByAccountId.mockResolvedValue(false);
    mockLedgerAccountRepo.findById.mockResolvedValue(header);
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([]);
  });

  it('does not inspect balances or journals when currency is omitted', async () => {
    await expect(
      service.validateCurrencyChange(cash, undefined, repoOptions)
    ).resolves.toBeUndefined();
    expect(mockJournalEntryRepo.existsByAccountId).not.toHaveBeenCalled();
  });
  it('allows an unreferenced account beneath the cash header', async () => {
    await service.validateCurrencyChange(
      cash,
      SYSTEM_CURRENCIES.USD,
      repoOptions
    );
    expect(mockJournalEntryRepo.existsByAccountId).toHaveBeenCalledWith(
      cash.id,
      cash.accountingEntityId,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
  });
  it('treats the current currency as a no-op even with journal references', async () => {
    mockJournalEntryRepo.existsByAccountId.mockResolvedValue(true);
    await service.validateCurrencyChange(cash, SYSTEM_CURRENCIES.NGN, {
      correlationId: 'currency',
    });
    expect(mockJournalEntryRepo.existsByAccountId).not.toHaveBeenCalled();
  });
  it('rejects any journal association regardless of balance or account status', async () => {
    mockJournalEntryRepo.existsByAccountId.mockResolvedValue(true);
    await expect(
      service.validateCurrencyChange(cash, SYSTEM_CURRENCIES.USD, repoOptions)
    ).rejects.toThrow(ledgerAccountError.CurrencyChangeHasJournalEntries);
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });
  it('requires a transaction for the reference check', async () => {
    await expect(
      service.validateCurrencyChange(cash, SYSTEM_CURRENCIES.USD, {
        correlationId: 'currency',
      })
    ).rejects.toThrow(ledgerAccountError.CurrencyChangeTransactionRequired);
  });
  it('rejects roots and missing parents', async () => {
    await expect(
      service.validateCurrencyChange(header, SYSTEM_CURRENCIES.USD, repoOptions)
    ).rejects.toThrow(ledgerAccountError.InvalidControlAccountId);
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(
      service.validateCurrencyChange(cash, SYSTEM_CURRENCIES.USD, repoOptions)
    ).rejects.toThrow(ledgerAccountError.ControlAccountNotFound);
  });
  it('preserves a nested parent currency', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...cash,
      isControlAccount: true,
    });
    await expect(
      service.validateCurrencyChange(cash, SYSTEM_CURRENCIES.USD, repoOptions)
    ).rejects.toThrow(ledgerAccountError.ControlAccountCurrencyMismatch);
    await service.validateCurrencyChange(
      { ...cash, currency: SYSTEM_CURRENCIES.USD },
      SYSTEM_CURRENCIES.NGN,
      repoOptions
    );
  });
  it('allows an empty control account but rejects incompatible descendants', async () => {
    const control = { ...cash, isControlAccount: true };
    await service.validateCurrencyChange(
      control,
      SYSTEM_CURRENCIES.USD,
      repoOptions
    );
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([cash]);
    await expect(
      service.validateCurrencyChange(
        control,
        SYSTEM_CURRENCIES.USD,
        repoOptions
      )
    ).rejects.toThrow(ledgerAccountError.ControlAccountCurrencyMismatch);
    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledWith(
      control.accountingEntityId,
      control.materializedPath,
      repoOptions
    );
  });
});
