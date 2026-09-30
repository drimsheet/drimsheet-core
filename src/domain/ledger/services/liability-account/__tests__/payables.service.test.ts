import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
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
  IPayableAccount,
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

describe('payablesAccountService', () => {
  const service = makePayablesAccountService({ ledgerAccountRepo });
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
  const makeControlAccount = (
    behavior: IPayableAccount['behavior'] = ELiabilityAccountBehavior.DefaultPayable,
    overrides: Partial<Pick<ILedgerAccount, 'currency'>> = {}
  ) =>
    ledgerAccountEntity.make<IPayableAccount>({
      name: 'Payables',
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: createdBy,
      ...overrides,
    })[0];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('creates a payable header when one does not exist', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createHeader(
      {
        name: 'Payables',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Payables',
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      type: ELedgerType.Liability,
      normalBalance: ENormalBalance.Credit,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.DefaultPayable,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: createdBy,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('rejects a duplicate payable header', async () => {
    const existingHeader = makeControlAccount();
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);

    await expect(
      service.createHeader(
        {
          name: 'Payables',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
      cause: { existingHeader },
    });
  });

  it('creates a statutory payable under a valid control account', () => {
    const controlAccount = makeControlAccount();

    const [account, events, audit] = service.createStatutoryPayableSubAccount({
      controlAccount,
      name: 'Personal Income Tax',
      createdBy: createdBy,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
      isControlAccount: false,

      meta: {
        taxAuthority: ' Federal Inland Revenue Service ',
        taxType: ' personal_income_tax ',
      },
    });

    expect(account).toMatchObject({
      code: LIABILITY_LEDGER_CODES.PAYABLES.TRADE,
      materializedPath: `${LIABILITY_LEDGER_CODES.PAYABLES.HEADER}.${LIABILITY_LEDGER_CODES.PAYABLES.TRADE}`,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.TaxPayable,
      isControlAccount: false,
      controlAccountId: controlAccount.id,
      currency: SYSTEM_CURRENCIES.USD,
      meta: {
        taxAuthority: 'Federal Inland Revenue Service',
        taxType: 'personal_income_tax',
      },
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
    expect(Object.isFrozen(account.meta)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('creates a trade payable after the latest payable', () => {
    const controlAccount = makeControlAccount(
      ELiabilityAccountBehavior.TradePayable
    );
    const counterpartyId = generateUUID();
    const invoiceId = generateUUID();

    const [account] = service.createTradePayableSubAccount({
      controlAccount,
      name: 'Supplier Invoice',
      createdBy: createdBy,
      accountingEntity,
      isControlAccount: false,

      meta: { counterpartyId, invoiceId },
    });

    expect(account).toMatchObject({
      code: '201001',
      materializedPath: `${LIABILITY_LEDGER_CODES.PAYABLES.HEADER}.201001`,
      behavior: ELiabilityAccountBehavior.TradePayable,
      controlAccountId: controlAccount.id,
      currency: null,
      meta: { counterpartyId, invoiceId },
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    });
    expect(Object.isFrozen(account.meta)).toBe(true);
  });

  it('rejects a payable control account from another accounting entity', () => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      accountingEntityId: generateUUID(),
    };

    expect(() =>
      service.createTradePayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Supplier Invoice',
        createdBy: createdBy,
        accountingEntity,
        isControlAccount: false,

        meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
      })
    ).toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });

  it('creates a null-currency trade payable under a null-currency trade control', () => {
    const controlAccount = makeControlAccount(
      ELiabilityAccountBehavior.TradePayable,
      { currency: null }
    );

    const [account] = service.createTradePayableSubAccount({
      controlAccount,
      name: 'Nested Trade Payable',
      createdBy: createdBy,
      accountingEntity,
      isControlAccount: false,

      meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
    });

    expect(account.controlAccountId).toBe(controlAccount.id);
    expect(account.currency).toBeNull();
  });

  it.each([
    { type: ELedgerType.Asset },
    { subType: ELiabilitySubType.Suspense },
    { isControlAccount: false },
    { behavior: ELiabilityAccountBehavior.TradePayable },
    { currency: null },
  ])('rejects an invalid statutory control account: %o', (change) => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      ...change,
    };

    expect(() =>
      service.createStatutoryPayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Tax Payable',
        createdBy: createdBy,
        accountingEntity,
        currency: SYSTEM_CURRENCIES.USD,
        isControlAccount: false,

        meta: { taxAuthority: 'FIRS', taxType: 'VAT' },
      })
    ).toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });

  it.each([
    { type: ELedgerType.Asset },
    { subType: ELiabilitySubType.Suspense },
    { isControlAccount: false },
    { behavior: ELiabilityAccountBehavior.TaxPayable },
  ])('rejects an invalid trade control account: %o', (change) => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      ...change,
    };

    expect(() =>
      service.createTradePayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Supplier Invoice',
        createdBy: createdBy,
        accountingEntity,
        isControlAccount: false,

        meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
      })
    ).toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });

  it('creates trade and statutory control accounts with null metadata', () => {
    const controlAccount = makeControlAccount();
    const payload = {
      controlAccount,
      createdBy,
      accountingEntity,
      isControlAccount: true,
      meta: null,
    };
    const [trade, tradeEvents, tradeAudit] =
      service.createTradePayableSubAccount({
        ...payload,
        name: 'Trade Payables',
      });
    const [statutory, statutoryEvents, statutoryAudit] =
      service.createStatutoryPayableSubAccount({
        ...payload,
        name: 'Statutory Payables',
        currency: SYSTEM_CURRENCIES.USD,
      });
    expect(trade).toMatchObject({
      isControlAccount: true,
      controlAccountId: controlAccount.id,
      meta: null,
      currency: null,
    });
    expect(statutory).toMatchObject({
      isControlAccount: true,
      controlAccountId: controlAccount.id,
      meta: null,
      currency: SYSTEM_CURRENCIES.USD,
    });
    expect(tradeEvents[0].data).toEqual(trade);
    expect(statutoryEvents[0].data).toEqual(statutory);
    expect(tradeAudit.entityId).toBe(trade.id);
    expect(statutoryAudit.entityId).toBe(statutory.id);
    expect(Object.isFrozen(trade)).toBe(true);
    expect(Object.isFrozen(statutory)).toBe(true);
  });

  it('returns an immutable service', () => {
    expect(Object.isFrozen(service)).toBe(true);
  });
});
