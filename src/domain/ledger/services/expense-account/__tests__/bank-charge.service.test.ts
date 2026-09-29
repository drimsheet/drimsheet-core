import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeBankChargeAccountService from '@domain/ledger/services/expense-account/bank-charge.service';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
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

describe('bankChargeAccountService', () => {
  const service = makeBankChargeAccountService({
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

  const makeControlAccount = (
    behavior: string = EExpenseAccountBehavior.BankCharge,
    overrides: Partial<ILedgerAccount> = {}
  ) =>
    ledgerAccountEntity.make<ILedgerAccount>({
      name: 'Bank Charge',
      code: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.BankCharge,
      behavior,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
      ...overrides,
    })[0];

  const subAccountPayload = {
    name: 'Bank Charge (Default)',
    createdBy: createdBy,
    accountingEntityId: accountingEntity.id,
    isControlAccount: false,
    controlAccountCode: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a frozen bank-charge header when one does not exist', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createHeader(
      {
        name: 'Bank Charge',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Bank Charge',
      code: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.BankCharge,
      behavior: EExpenseAccountBehavior.BankCharge,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: createdBy,
    });
    expect(Object.isFrozen(service)).toBe(true);
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });

  it('rejects a duplicate bank-charge header', async () => {
    const existingHeader = makeControlAccount();
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);

    await expect(
      service.createHeader(
        {
          name: 'Bank Charge',
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

  it.each([
    EExpenseAccountBehavior.BankCharge,
    EExpenseAccountBehavior.Default,
  ])(
    'creates a sub-account under a %s control account',
    async (controlAccountBehavior) => {
      const controlAccount = makeControlAccount(controlAccountBehavior);
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
      mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
        id: generateUUID(),
        code: `${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}099`,
        materializedPath: `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}099`,
      });

      const [account, events, audit] = await service.createSubAccount(
        subAccountPayload,
        repoOptions
      );

      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        subAccountPayload.controlAccountCode,
        accountingEntity.id,
        repoOptions
      );
      expect(account).toMatchObject({
        name: subAccountPayload.name,
        code: `${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}100`,
        materializedPath: `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}100`,
        accountingEntityId: accountingEntity.id,
        normalBalance: ENormalBalance.Debit,
        type: ELedgerType.Expense,
        subType: EExpenseSubType.BankCharge,
        behavior: EExpenseAccountBehavior.BankCharge,
        isControlAccount: false,
        controlAccountId: controlAccount.id,
        currency: null,
        meta: null,
        status: ELedgerAccountStatus.Active,
        contraAccountRule: EContraAccountRule.ContraNotPermitted,
        adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
        createdBy: createdBy,
      });
      expect(Object.isFrozen(account)).toBe(true);
      expect(events).toHaveLength(1);
      expect(audit.entityId).toBe(account.id);
    }
  );

  it('allocates the first sub-account code when no later account exists', async () => {
    const controlAccount = makeControlAccount();
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    const [account] = await service.createSubAccount(
      subAccountPayload,
      repoOptions
    );

    expect(account.code).toBe(`${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}001`);
    expect(account.materializedPath).toBe(
      `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.BANK_CHARGE.PREFIX}001`
    );
  });

  it('rejects a missing control account', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    await expect(
      service.createSubAccount(subAccountPayload, repoOptions)
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_account_control_account_not_found_unexpected',
    });
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'type', overrides: { type: ELedgerType.Asset } },
    {
      label: 'subtype',
      overrides: { subType: EExpenseSubType.LossOnAssetDisposal },
    },
    { label: 'control status', overrides: { isControlAccount: false } },
    {
      label: 'behavior',
      overrides: { behavior: EExpenseAccountBehavior.AssetDisposalLoss },
    },
  ])(
    'rejects a control account with an invalid $label',
    async ({ overrides }) => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
        makeControlAccount(EExpenseAccountBehavior.BankCharge, overrides)
      );

      await expect(
        service.createSubAccount(subAccountPayload, repoOptions)
      ).rejects.toMatchObject({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      });
      expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );
});
