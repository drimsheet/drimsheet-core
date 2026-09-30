import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeSuspenseAccountService from '@domain/ledger/services/suspense-account/suspense-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  findByCodeForUpdate: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};

describe('suspenseAccountService', () => {
  const service = makeSuspenseAccountService({ ledgerAccountRepo });
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  const payload = {
    accountingEntityId,
    createdBy: createdBy,
    currency: SYSTEM_CURRENCIES.USD,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.resetAllMocks();
    ledgerAccountRepo.findBySubType.mockResolvedValue([]);
    ledgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the first asset suspense account', async () => {
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createAssetSuspense(
      { ...payload, name: 'Asset Suspense Account' },
      repoOptions
    );

    expect(ledgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      accountingEntityId,
      ELedgerType.Asset,
      EAssetSubType.Suspense,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Asset Suspense Account',
      code: ASSET_LEDGER_CODES.SUSPENSE_ACCOUNT.INITIAL,
      materializedPath: ASSET_LEDGER_CODES.SUSPENSE_ACCOUNT.INITIAL,
      accountingEntityId,
      createdBy: createdBy,
      currency: SYSTEM_CURRENCIES.USD,
      type: ELedgerType.Asset,
      normalBalance: ENormalBalance.Debit,
      subType: EAssetSubType.Suspense,
      behavior: EAssetAccountBehavior.Default,
      meta: null,
      isControlAccount: false,
      controlAccountId: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('increments the latest asset suspense code', async () => {
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      code: '199099',
    } as ILedgerAccount);

    const [account] = await service.createAssetSuspense(
      { ...payload, name: 'Asset Suspense Account' },
      repoOptions
    );

    expect(account.code).toBe('199100');
    expect(account.materializedPath).toBe('199100');
  });

  it('creates the first liability suspense account', async () => {
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createLiabilitySuspense(
      { ...payload, name: 'Liability Suspense Account' },
      repoOptions
    );

    expect(ledgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      accountingEntityId,
      ELedgerType.Liability,
      ELiabilitySubType.Suspense,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Liability Suspense Account',
      code: LIABILITY_LEDGER_CODES.SUSPENSE_ACCOUNTS.INITIAL,
      materializedPath: LIABILITY_LEDGER_CODES.SUSPENSE_ACCOUNTS.INITIAL,
      accountingEntityId,
      createdBy: createdBy,
      currency: SYSTEM_CURRENCIES.USD,
      type: ELedgerType.Liability,
      normalBalance: ENormalBalance.Credit,
      subType: ELiabilitySubType.Suspense,
      behavior: ELiabilityAccountBehavior.Default,
      meta: null,
      isControlAccount: false,
      controlAccountId: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('increments the latest liability suspense code', async () => {
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      code: '299099',
    } as ILedgerAccount);

    const [account] = await service.createLiabilitySuspense(
      { ...payload, name: 'Liability Suspense Account' },
      repoOptions
    );

    expect(account.code).toBe('299100');
    expect(account.materializedPath).toBe('299100');
  });

  it('propagates ledger account validation failures', async () => {
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    await expect(
      service.createAssetSuspense({ ...payload, name: 'A' }, repoOptions)
    ).rejects.toThrow();
  });

  it('returns an immutable service', () => {
    expect(Object.isFrozen(service)).toBe(true);
  });

  describe.each([
    ['asset', 'createAssetSuspense', '199000', '199999'],
    ['liability', 'createLiabilitySuspense', '299000', '299999'],
  ] as const)('%s uniqueness', (type, method, initial, last) => {
    it.each(['active', 'archived', 'deleted'] as const)(
      'rejects a matching nonlatest currency even when renamed or %s',
      async (state) => {
        const [existing] = await service[method](
          { ...payload, name: 'Original' },
          repoOptions
        );
        const [otherCurrency] = await service[method](
          {
            ...payload,
            name: 'Other currency',
            currency: SYSTEM_CURRENCIES.NGN,
          },
          repoOptions
        );
        ledgerAccountRepo.findBySubType.mockResolvedValue([
          {
            ...existing,
            name: 'Renamed',
            status: state === 'archived' ? 'archived' : 'active',
            deletedAt: state === 'deleted' ? new Date() : null,
          },
          otherCurrency,
        ]);
        ledgerAccountRepo.findLatestBySubType.mockClear();
        await expect(
          service[method]({ ...payload, name: 'New name' }, repoOptions)
        ).rejects.toBeInstanceOf(
          ledgerAccountError.SuspenseAccountAlreadyExists
        );
        expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
        expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
      }
    );

    it('reads only this entity/type and propagates the transaction to both reads', async () => {
      const options = { ...repoOptions, tx: {} };
      const [otherCurrency] = await service[method](
        {
          ...payload,
          name: 'Other currency',
          currency: SYSTEM_CURRENCIES.NGN,
        },
        repoOptions
      );
      ledgerAccountRepo.findBySubType.mockResolvedValue([otherCurrency]);
      ledgerAccountRepo.findLatestBySubType.mockResolvedValue(otherCurrency);
      const [created] = await service[method](
        { ...payload, name: 'USD account' },
        options
      );
      expect(ledgerAccountRepo.findBySubType).toHaveBeenLastCalledWith(
        accountingEntityId,
        type,
        'suspense',
        options
      );
      expect(ledgerAccountRepo.findLatestBySubType).toHaveBeenLastCalledWith(
        accountingEntityId,
        type,
        'suspense',
        options
      );
      expect(created.code).toBe(String(Number(initial) + 1));
      expect(created.currency?.code).toBe('USD');
      expect(created.materializedPath).toBe(created.code);
    });

    it('does not mistake a legacy null currency for a matching currency', async () => {
      const [existing] = await service[method](
        { ...payload, name: 'Existing' },
        repoOptions
      );
      ledgerAccountRepo.findBySubType.mockResolvedValue([
        { ...existing, currency: null },
      ]);
      ledgerAccountRepo.findLatestBySubType.mockResolvedValue(existing);
      await expect(
        service[method]({ ...payload, name: 'USD account' }, repoOptions)
      ).resolves.toBeDefined();
    });

    it('preserves code exhaustion without writes', async () => {
      ledgerAccountRepo.findLatestBySubType.mockResolvedValue({
        id: generateUUID(),
        code: last,
        materializedPath: last,
      });
      await expect(
        service[method]({ ...payload, name: 'Exhausted' }, repoOptions)
      ).rejects.toBeInstanceOf(ledgerAccountError.MaximumLimitReached);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('propagates repository failures without writes', async () => {
      const failure = new Error('read failed');
      ledgerAccountRepo.findBySubType.mockRejectedValueOnce(failure);
      await expect(
        service[method]({ ...payload, name: 'Suspense' }, repoOptions)
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });
  });
});
