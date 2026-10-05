import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeLedgerCodeAllocationService from '@domain/ledger/services/ledger-code-allocation.service';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

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

describe('ledger code allocation', () => {
  const service = makeLedgerCodeAllocationService({
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
    mockLedgerAccountRepo.findByCode.mockResolvedValue(header);
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue({
      id: header.id,
      code: '100041',
      materializedPath: '100000.100041',
    });
  });
  it('selects the next family code without reserving or writing it', async () => {
    await expect(service.getNextCode(payload, options)).resolves.toBe('100042');
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      '100000',
      header.accountingEntityId,
      { ...options, lock: ERepoLock.Update }
    );
    expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      header.accountingEntityId,
      header.type,
      header.subType,
      options
    );
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
  });
  it('waits for the allocation lock before querying the predecessor', async () => {
    let release!: (value: typeof header) => void;
    mockLedgerAccountRepo.findByCode.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const code = service.getNextCode(payload, options);
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    release(header);
    await expect(code).resolves.toBe('100042');
  });
  it('falls back to the header when no latest account exists', async () => {
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
    await expect(service.getNextCode(payload, options)).resolves.toBe('100001');
  });
  it('rejects an archived allocation header before selecting another child code', async () => {
    const [archived] = ledgerAccountEntity.archive(header);
    mockLedgerAccountRepo.findByCode.mockResolvedValue(archived);
    await expect(service.getNextCode(payload, options)).rejects.toBeInstanceOf(
      ledgerAccountError.ArchivedControlAccount
    );
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });
  it('rejects a missing transaction before reading', async () => {
    await expect(
      // @ts-expect-error Exercise runtime contract.
      service.getNextCode(payload, { correlationId: 'allocation' })
    ).rejects.toBeInstanceOf(
      ledgerAccountError.CodeAllocationTransactionRequired
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
  });
  it('rejects missing header configuration', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
    await expect(service.getNextCode(payload, options)).rejects.toBeInstanceOf(
      ledgerAccountError.ControlAccountNotFound
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
  it.each(['findByCode', 'findLatestBySubType'] as const)(
    'propagates %s failure',
    async (method) => {
      const failure = new Error('database unavailable');
      mockLedgerAccountRepo[method].mockRejectedValue(failure);
      await expect(service.getNextCode(payload, options)).rejects.toBe(failure);
    }
  );
});
