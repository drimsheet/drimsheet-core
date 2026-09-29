import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeInterestAccountService from '@domain/ledger/services/expense-account/interest.service';
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

describe('interestAccountService', () => {
  const service = makeInterestAccountService({
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
    behavior: string = EExpenseAccountBehavior.Interest,
    overrides: Partial<ILedgerAccount> = {}
  ) =>
    ledgerAccountEntity.make<ILedgerAccount>({
      name: 'Interest',
      code: EXPENSE_LEDGER_CODES.INTEREST.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.INTEREST.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.Interest,
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
    name: 'Interest (Default)',
    createdBy: createdBy,
    accountingEntityId: accountingEntity.id,
    isControlAccount: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('creates a frozen interest header when one does not exist', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account, events, audit] = await service.createHeader(
      {
        name: 'Interest',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      EXPENSE_LEDGER_CODES.INTEREST.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Interest',
      code: EXPENSE_LEDGER_CODES.INTEREST.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.INTEREST.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.Interest,
      behavior: EExpenseAccountBehavior.Interest,
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

  it('rejects a duplicate interest header', async () => {
    const existingHeader = makeControlAccount();
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);

    await expect(
      service.createHeader(
        {
          name: 'Interest',
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

  it.each([EExpenseAccountBehavior.Interest, EExpenseAccountBehavior.Default])(
    'creates a sub-account under a %s control account',
    (controlAccountBehavior) => {
      const controlAccount = makeControlAccount(controlAccountBehavior);

      const [account, events, audit] = service.createSubAccount({
        ...subAccountPayload,
        controlAccount,
      });

      expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
      expect(account).toMatchObject({
        name: subAccountPayload.name,
        code: `${EXPENSE_LEDGER_CODES.INTEREST.PREFIX}001`,
        materializedPath: `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.INTEREST.PREFIX}001`,
        accountingEntityId: accountingEntity.id,
        normalBalance: ENormalBalance.Debit,
        type: ELedgerType.Expense,
        subType: EExpenseSubType.Interest,
        behavior: EExpenseAccountBehavior.Interest,
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

  it('derives the candidate and full path from a nested control account', () => {
    const header = makeControlAccount();
    const controlAccount = {
      ...header,
      id: generateUUID(),
      controlAccountId: header.id,
      currency: null,
      code: header.code.slice(0, 3) + '037',
      materializedPath:
        header.materializedPath + '.' + header.code.slice(0, 3) + '037',
    };

    const [account] = service.createSubAccount({
      ...subAccountPayload,
      controlAccount,
    });

    expect(account.code).toBe(`${EXPENSE_LEDGER_CODES.INTEREST.PREFIX}038`);
    expect(account.materializedPath).toBe(
      `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.INTEREST.PREFIX}038`
    );
  });

  it('rejects a control account from another accounting entity', () => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      accountingEntityId: generateUUID(),
    };

    expect(() =>
      service.createSubAccount({
        ...subAccountPayload,
        controlAccount: suppliedControlAccount,
      })
    ).toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
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
  ])('rejects a control account with an invalid $label', ({ overrides }) => {
    const suppliedControlAccount = makeControlAccount(
      EExpenseAccountBehavior.Interest,
      overrides
    );

    expect(() =>
      service.createSubAccount({
        ...subAccountPayload,
        controlAccount: suppliedControlAccount,
      })
    ).toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });
});
