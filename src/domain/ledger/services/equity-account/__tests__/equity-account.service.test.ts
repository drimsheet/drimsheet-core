import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { EQUITY_LEDGER_CODES } from '@domain/ledger/config/equity-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import {
  EEquityAccountBehavior,
  EEquitySubType,
  IOpeningBalanceEquityAccount,
  IRetainedEarningsAccount,
} from '@domain/ledger/types/equity-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
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

describe('equityAccountService', () => {
  const service = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const createdBy = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: createdBy,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as IAccountingEntity;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an opening-balance equity account when one does not exist', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createOpeningBalanceAccount(
      {
        name: 'Opening Balance Equity',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Opening Balance Equity',
      code: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      materializedPath: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Equity,
      subType: EEquitySubType.OpeningBalance,
      behavior: EEquityAccountBehavior.OpeningBalanceEquity,
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('rejects a duplicate opening-balance equity account', async () => {
    const existing = ledgerAccountEntity.make<IOpeningBalanceEquityAccount>({
      name: 'Opening Balance Equity',
      code: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      materializedPath: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Equity,
      subType: EEquitySubType.OpeningBalance,
      behavior: EEquityAccountBehavior.OpeningBalanceEquity,
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
    })[0];
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existing);

    await expect(
      service.createOpeningBalanceAccount(
        {
          name: 'Opening Balance Equity',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_opening_balance_account_already_exists_conflict',
      cause: { existing },
    });
  });

  it('creates a retained-earnings account when one does not exist', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] =
      await service.createRetainedEarningsAccount(
        {
          name: 'Retained Earnings',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      );

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Retained Earnings',
      code: EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      materializedPath: EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Equity,
      subType: EEquitySubType.RetainedEarnings,
      behavior: EEquityAccountBehavior.RetainedEarnings,
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('rejects a duplicate retained-earnings account', async () => {
    const existing = ledgerAccountEntity.make<IRetainedEarningsAccount>({
      name: 'Retained Earnings',
      code: EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      materializedPath: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Equity,
      subType: EEquitySubType.RetainedEarnings,
      behavior: EEquityAccountBehavior.RetainedEarnings,
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
    })[0];
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existing);

    await expect(
      service.createRetainedEarningsAccount(
        {
          name: 'Retained Earnings',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_retained_earnings_account_already_exists_conflict',
      cause: { existing },
    });
  });
});
