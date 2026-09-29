import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeReceivablesAccountService from '@domain/ledger/services/asset-account/receivables-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
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

describe('receivablesAccountService', () => {
  const service = makeReceivablesAccountService({ ledgerAccountRepo });
  const userId = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: userId,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as IAccountingEntity;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  const receivablesHeader = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
    materializedPath: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
    accountingEntityId: accountingEntity.id,
    type: ELedgerType.Asset,
    subType: EAssetSubType.Receivables,
    behavior: EAssetAccountBehavior.DefaultReceivables,
    isControlAccount: true,
    controlAccountId: null,
    currency: SYSTEM_CURRENCIES.USD,
  } as ILedgerAccount;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the receivables header when one does not exist', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createHeader(
      {
        name: 'Receivables',
        createdBy: userId,
        accountingEntity,
      },
      repoOptions
    );

    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Receivables',
      code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      materializedPath: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.DefaultReceivables,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: userId,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('rejects a duplicate receivables header', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(receivablesHeader);

    await expect(
      service.createHeader(
        {
          name: 'Receivables',
          createdBy: userId,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
      cause: { existingHeader: receivablesHeader },
    });
  });

  it('creates a trade receivable under a valid control account', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(receivablesHeader);
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
      id: generateUUID(),
      code: '102004',
      materializedPath: '102000.102004',
    });

    const [account, events, audit] =
      await service.createTradeReceivableSubAccount(
        {
          name: 'Trade Receivables',
          createdBy: userId,
          accountingEntity,
          currency: SYSTEM_CURRENCIES.USD,
          isControlAccount: true,
          controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
        },
        repoOptions
      );

    expect(account).toMatchObject({
      name: 'Trade Receivables',
      code: '102005',
      materializedPath: '102000.102005',
      behavior: EAssetAccountBehavior.TradeReceivable,
      controlAccountId: receivablesHeader.id,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    });
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('creates a statutory receivable under a valid control account', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce({
      ...receivablesHeader,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
    });
    ledgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    const [account] = await service.createStatutoryReceivableSubAccount(
      {
        name: 'Statutory Receivables',
        createdBy: userId,
        accountingEntity,
        currency: SYSTEM_CURRENCIES.USD,
        isControlAccount: true,
        controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      },
      repoOptions
    );

    expect(account).toMatchObject({
      code: ASSET_LEDGER_CODES.RECEIVABLES.TRADE,
      materializedPath: `${ASSET_LEDGER_CODES.RECEIVABLES.HEADER}.${ASSET_LEDGER_CODES.RECEIVABLES.TRADE}`,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
      controlAccountId: receivablesHeader.id,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
  });

  it('rejects a missing receivables control account', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    await expect(
      service.createTradeReceivableSubAccount(
        {
          name: 'Trade Receivables',
          createdBy: userId,
          accountingEntity,
          currency: SYSTEM_CURRENCIES.USD,
          isControlAccount: false,
          controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_account_control_account_not_found_unexpected',
    });
    expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });

  it.each([
    { type: ELedgerType.Liability },
    { subType: EAssetSubType.CashAndCashEquivalent },
    { isControlAccount: false },
    { behavior: EAssetAccountBehavior.StatutoryReceivable },
  ])(
    'rejects an invalid trade receivables control account: %o',
    async (change) => {
      ledgerAccountRepo.findByCode.mockResolvedValueOnce({
        ...receivablesHeader,
        ...change,
      });

      await expect(
        service.createTradeReceivableSubAccount(
          {
            name: 'Trade Receivables',
            createdBy: userId,
            accountingEntity,
            currency: SYSTEM_CURRENCIES.USD,
            isControlAccount: false,
            controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
          },
          repoOptions
        )
      ).rejects.toMatchObject({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      });
      expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );

  it.each([
    { type: ELedgerType.Liability },
    { subType: EAssetSubType.CashAndCashEquivalent },
    { isControlAccount: false },
    { behavior: EAssetAccountBehavior.TradeReceivable },
  ])(
    'rejects an invalid statutory receivables control account: %o',
    async (change) => {
      ledgerAccountRepo.findByCode.mockResolvedValueOnce({
        ...receivablesHeader,
        ...change,
      });

      await expect(
        service.createStatutoryReceivableSubAccount(
          {
            name: 'Statutory Receivables',
            createdBy: userId,
            accountingEntity,
            currency: SYSTEM_CURRENCIES.USD,
            isControlAccount: false,
            controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
          },
          repoOptions
        )
      ).rejects.toMatchObject({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      });
      expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );
});
