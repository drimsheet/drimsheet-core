import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeLedgerAccountArchiveService from '@domain/ledger/services/ledger-account-archive.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

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
const service = makeLedgerAccountArchiveService({
  ledgerAccountRepo: mockLedgerAccountRepo,
});
const repoOptions = { correlationId: 'archive', tx: {} };

describe('ledger account archive service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([]);
  });

  afterEach(() => {
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
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
});
