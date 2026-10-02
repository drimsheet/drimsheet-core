import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeFinanceCostAccountService from '@domain/ledger/services/expense-account/finance-cost.service';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
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
const allocation: jest.Mocked<ILedgerCodeAllocationService> = {
  getNextCode: jest.fn(),
};

describe('financeCostAccountService', () => {
  const service = makeFinanceCostAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerCodeAllocationService: allocation,
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
    behavior: string = EExpenseAccountBehavior.FinanceCost,
    overrides: Partial<ILedgerAccount> = {}
  ) =>
    ledgerAccountEntity.make<ILedgerAccount>({
      name: 'Finance Cost',
      code: EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.FinanceCost,
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
    name: 'Finance Cost (Default)',
    createdBy: createdBy,
    accountingEntityId: accountingEntity.id,
    isControlAccount: false,
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  async function prepareSubAccount(
    payload: Omit<
      Parameters<typeof service.createSubAccount>[0],
      'controlAccountId'
    > & { controlAccount: ILedgerAccount }
  ) {
    const { controlAccount, ...facts } = payload;
    mockLedgerAccountRepo.findByCode.mockResolvedValue(controlAccount);
    mockLedgerAccountRepo.findById.mockResolvedValue(controlAccount);
    allocation.getNextCode.mockResolvedValue(
      String(Number(controlAccount.code) + 1).padStart(6, '0')
    );
    return service.createSubAccount(
      { ...facts, controlAccountId: controlAccount.id },
      { correlationId: 'creation-test', tx: {} }
    );
  }

  afterEach(() => {
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  it('creates a frozen finance-cost header when one does not exist', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [account, events, audit] = await service.createHeader(
      {
        name: 'Finance Cost',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Finance Cost',
      code: EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
      materializedPath: EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Debit,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.FinanceCost,
      behavior: EExpenseAccountBehavior.FinanceCost,
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
  it('rejects a duplicate finance-cost header', async () => {
    const existingHeader = makeControlAccount();
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);
    await expect(
      service.createHeader(
        {
          name: 'Finance Cost',
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
    EExpenseAccountBehavior.FinanceCost,
    EExpenseAccountBehavior.Default,
  ])(
    'creates a sub-account under a %s control account',
    async (controlAccountBehavior) => {
      const controlAccount = makeControlAccount(controlAccountBehavior);
      const [account, events, audit] = await prepareSubAccount({
        ...subAccountPayload,
        controlAccount,
      });

      expect(account).toMatchObject({
        name: subAccountPayload.name,
        code: `${EXPENSE_LEDGER_CODES.FINANCE_COST.PREFIX}001`,
        materializedPath: `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.FINANCE_COST.PREFIX}001`,
        accountingEntityId: accountingEntity.id,
        normalBalance: ENormalBalance.Debit,
        type: ELedgerType.Expense,
        subType: EExpenseSubType.FinanceCost,
        behavior: EExpenseAccountBehavior.FinanceCost,
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
  it('derives the candidate and full path from a nested control account', async () => {
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
    const [account] = await prepareSubAccount({
      ...subAccountPayload,
      controlAccount,
    });
    expect(account.code).toBe(`${EXPENSE_LEDGER_CODES.FINANCE_COST.PREFIX}038`);
    expect(account.materializedPath).toBe(
      `${controlAccount.materializedPath}.${EXPENSE_LEDGER_CODES.FINANCE_COST.PREFIX}038`
    );
  });
  it('rejects a control account from another accounting entity', async () => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      accountingEntityId: generateUUID(),
    };
    await expect(
      prepareSubAccount({
        ...subAccountPayload,
        controlAccount: suppliedControlAccount,
      })
    ).rejects.toThrow(
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
  ])(
    'rejects a control account with an invalid $label',
    async ({ overrides }) => {
      const suppliedControlAccount = makeControlAccount(
        EExpenseAccountBehavior.FinanceCost,
        overrides
      );
      await expect(
        prepareSubAccount({
          ...subAccountPayload,
          controlAccount: suppliedControlAccount,
        })
      ).rejects.toThrow(
        expect.objectContaining({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
        })
      );
      expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );
  describe('createSubAccount protected creation', () => {
    const createdBy = generateUUID();
    const accountingEntity = {
      id: generateUUID(),
      createdBy,
      ownerId: createdBy,
      functionalCurrencyCode: 'USD',
    } as IAccountingEntity;
    const options = { correlationId: 'protected-creation', tx: {} };
    let header: ILedgerAccount;
    const payload: Parameters<typeof service.createSubAccount>[0] = {
      name: 'Final account',
      createdBy,
      isControlAccount: false,
      accountingEntityId: accountingEntity.id,
    };
    beforeEach(async () => {
      mockLedgerAccountRepo.findByCode.mockReset().mockResolvedValue(null);
      header = (
        await service.createHeader(
          { name: 'Root account', accountingEntity, createdBy },
          options
        )
      )[0];
      jest.clearAllMocks();
      mockLedgerAccountRepo.findByCode.mockResolvedValue(header);
      mockLedgerAccountRepo.findById.mockResolvedValue(header);
      allocation.getNextCode
        .mockReset()
        .mockResolvedValue(header.code.slice(0, 3) + '042');
    });
    it('uses the established default parent and creates the final version 1 state once', async () => {
      const [account, events, audit] = await service.createSubAccount(
        payload,
        options
      );
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(account).toMatchObject({
        code: header.code.slice(0, 3) + '042',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '042',
        controlAccountId: header.id,
        version: 1,
      });
      expect(account.currency).toBe(null);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(account);
      expect(audit.diff).toMatchObject({ before: null, after: account });
      expect(Object.isFrozen(account)).toBe(true);
      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
    it('locks the common root before a nested explicit parent and keeps the selected path', async () => {
      const parent = ledgerAccountEntity.make<ILedgerAccount>({
        ...header,
        name: 'Nested parent',
        code: header.code.slice(0, 3) + '037',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '037',
        controlAccountId: header.id,
        currency: null,
      })[0];
      mockLedgerAccountRepo.findById.mockResolvedValue(parent);
      const [account] = await service.createSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        parent.id,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(
        mockLedgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(allocation.getNextCode.mock.invocationCallOrder[0]);
      expect(account.materializedPath).toBe(
        parent.materializedPath + '.' + account.code
      );
      expect(account.code).toBe(header.code.slice(0, 3) + '042');
    });
    it('rejects missing transaction context before any reads', async () => {
      await expect(
        service.createSubAccount(payload, {
          correlationId: 'missing',
          tx: undefined,
        } as unknown as typeof options)
      ).rejects.toBeInstanceOf(
        ledgerAccountError.CodeAllocationTransactionRequired
      );
      expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    });
    it('rejects a missing allocation root before parent resolution', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
      await expect(
        service.createSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createSubAccount(
          { ...payload, controlAccountId: createdBy },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('propagates allocation failure without creating or storing state', async () => {
      const failure = new ledgerAccountError.MaximumLimitReached();
      allocation.getNextCode.mockRejectedValueOnce(failure);
      await expect(service.createSubAccount(payload, options)).rejects.toBe(
        failure
      );
      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
    });
  });
});
