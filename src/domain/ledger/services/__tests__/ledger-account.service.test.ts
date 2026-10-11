import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeLedgerAccountService from '@domain/ledger/services/ledger-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

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
  findAll: jest.fn(),
};
const service = makeLedgerAccountService({
  ledgerAccountRepo: mockLedgerAccountRepo,
});
const repoOptions = { correlationId: 'archive', tx: {} };

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
