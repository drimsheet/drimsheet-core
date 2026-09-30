import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeAssetDisposalService from '@domain/ledger/services/expense-account/asset-disposal-loss.service';
import makeBankChargeAccountService from '@domain/ledger/services/expense-account/bank-charge.service';
import makeDirectCostsAccountService from '@domain/ledger/services/expense-account/direct-costs.service';
import makeFinanceCostAccountService from '@domain/ledger/services/expense-account/finance-cost.service';
import makeInterestAccountService from '@domain/ledger/services/expense-account/interest.service';
import makeRentAndUtilitiesAccountService from '@domain/ledger/services/expense-account/rent-and-utilities.service';
import makeTaxExpenseAccountService from '@domain/ledger/services/expense-account/tax-expense.service';
import makeUnrealizedLossAccountService from '@domain/ledger/services/expense-account/unrealized-loss.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import {
  mockAssetDisposalLossAccountService,
  mockBankChargeAccountService,
  mockDirectCostsAccountService,
  mockFinanceCostAccountService,
  mockInterestAccountService,
  mockRentAndUtilitiesAccountService,
  mockTaxExpenseAccountService,
  mockUnrealizedLossAccountService,
} from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import makeCreateExpenseAccountUsecase from '@app/ledger/usecases/create-expense-account.usecase';

const actor = actorEntity.makeUser({
  email: 'posting@example.com',
  displayName: 'Posting Owner',
})[0];
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const correlationId = 'posting-creation-spec';
const tx: ITransactionContext = {};
const repoOptions = { correlationId };
const cases = [
  {
    behavior: 'default_direct_cost',
    header: '500000',
    subType: 'direct_costs',
    service: mockDirectCostsAccountService,
  },
  {
    behavior: 'cogs',
    header: '500000',
    subType: 'direct_costs',
    service: mockDirectCostsAccountService,
  },
  {
    behavior: 'cost_of_services',
    header: '500000',
    subType: 'direct_costs',
    service: mockDirectCostsAccountService,
  },
  {
    behavior: 'cost_of_revenue',
    header: '500000',
    subType: 'direct_costs',
    service: mockDirectCostsAccountService,
  },
  {
    behavior: 'rent_and_utilities',
    header: '502000',
    subType: 'rent_and_utilities',
    service: mockRentAndUtilitiesAccountService,
  },
  {
    behavior: 'bank_charge',
    header: '507000',
    subType: 'bank_charge',
    service: mockBankChargeAccountService,
  },
  {
    behavior: 'finance_cost',
    header: '508000',
    subType: 'finance_cost',
    service: mockFinanceCostAccountService,
  },
  {
    behavior: 'interest',
    header: '509000',
    subType: 'interest',
    service: mockInterestAccountService,
  },
  {
    behavior: 'tax_expense',
    header: '510000',
    subType: 'income_tax_expense',
    service: mockTaxExpenseAccountService,
  },
  {
    behavior: 'unrealized_loss',
    header: '511000',
    subType: 'unrealized_loss',
    service: mockUnrealizedLossAccountService,
  },
  {
    behavior: 'asset_disposal_loss',
    header: '512000',
    subType: 'loss_on_asset_disposal',
    service: mockAssetDisposalLossAccountService,
  },
] as const;
const usecase = makeCreateExpenseAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  repoService: mockRepoService,
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  directCostsAccountService: mockDirectCostsAccountService,
  rentAndUtilitiesAccountService: mockRentAndUtilitiesAccountService,
  bankChargeAccountService: mockBankChargeAccountService,
  financeCostAccountService: mockFinanceCostAccountService,
  interestAccountService: mockInterestAccountService,
  taxExpenseAccountService: mockTaxExpenseAccountService,
  unrealizedLossAccountService: mockUnrealizedLossAccountService,
  assetDisposalLossAccountService: mockAssetDisposalLossAccountService,
});
const valid: ICreateExpenseAccountDto = {
  name: 'Custom account',
  isControlAccount: false,
  behavior: 'default_direct_cost',
};

describe('createExpenseAccountUsecase', () => {
  let parent: ILedgerAccount;
  let committed: boolean;
  beforeEach(async () => {
    jest.resetAllMocks();
    committed = false;
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
    const directCosts = makeDirectCostsAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockDirectCostsAccountService.createHeader.mockImplementation(
      directCosts.createHeader
    );
    mockDirectCostsAccountService.createSubAccount.mockImplementation(
      directCosts.createSubAccount
    );
    const rentAndUtilities = makeRentAndUtilitiesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockRentAndUtilitiesAccountService.createHeader.mockImplementation(
      rentAndUtilities.createHeader
    );
    mockRentAndUtilitiesAccountService.createSubAccount.mockImplementation(
      rentAndUtilities.createSubAccount
    );
    const bankCharge = makeBankChargeAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockBankChargeAccountService.createHeader.mockImplementation(
      bankCharge.createHeader
    );
    mockBankChargeAccountService.createSubAccount.mockImplementation(
      bankCharge.createSubAccount
    );
    const financeCost = makeFinanceCostAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockFinanceCostAccountService.createHeader.mockImplementation(
      financeCost.createHeader
    );
    mockFinanceCostAccountService.createSubAccount.mockImplementation(
      financeCost.createSubAccount
    );
    const interest = makeInterestAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockInterestAccountService.createHeader.mockImplementation(
      interest.createHeader
    );
    mockInterestAccountService.createSubAccount.mockImplementation(
      interest.createSubAccount
    );
    const taxExpense = makeTaxExpenseAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockTaxExpenseAccountService.createHeader.mockImplementation(
      taxExpense.createHeader
    );
    mockTaxExpenseAccountService.createSubAccount.mockImplementation(
      taxExpense.createSubAccount
    );
    const unrealizedLoss = makeUnrealizedLossAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockUnrealizedLossAccountService.createHeader.mockImplementation(
      unrealizedLoss.createHeader
    );
    mockUnrealizedLossAccountService.createSubAccount.mockImplementation(
      unrealizedLoss.createSubAccount
    );
    const assetDisposalLoss = makeAssetDisposalService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockAssetDisposalLossAccountService.createHeader.mockImplementation(
      assetDisposalLoss.createHeader
    );
    mockAssetDisposalLossAccountService.createSubAccount.mockImplementation(
      assetDisposalLoss.createSubAccount
    );
    parent = (
      await cases[0].service.createHeader(
        { name: 'Header', createdBy: actor.id, accountingEntity },
        repoOptions
      )
    )[0];
    mockLedgerAccountRepo.findByCode.mockResolvedValue(parent);
    mockLedgerAccountRepo.findById.mockResolvedValue(parent);
    mockLedgerAccountPersistenceService.createAndAssignCode.mockImplementation(
      async ({ account, allocationHeaderCode }) => {
        const [assigned, events] = ledgerAccountEntity.updateCode(
          account,
          String(Number(allocationHeaderCode) + 99)
        );
        return { account: assigned, events };
      }
    );
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      const result = await fn(tx);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      committed = true;
      return result;
    });
    mockEventBus.publish.mockImplementation(async () => {
      expect(committed).toBe(true);
    });
  });
  it.each(cases)(
    'dispatches $behavior with its allocation root and final DTO',
    async (entry) => {
      mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
      const header = (
        await entry.service.createHeader(
          { name: 'Header', createdBy: actor.id, accountingEntity },
          repoOptions
        )
      )[0];
      const control =
        entry.header === '500000'
          ? { ...header, behavior: entry.behavior }
          : header;
      mockLedgerAccountRepo.findByCode.mockResolvedValue(control);
      mockLedgerAccountRepo.findByCode.mockClear();
      const result = await usecase({ ...valid, behavior: entry.behavior });
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        entry.header,
        accountingEntity.id,
        repoOptions
      );
      expect(entry.service.createSubAccount).toHaveBeenCalledTimes(1);
      expect(entry.service.createSubAccount).toHaveBeenCalledWith({
        name: valid.name,
        isControlAccount: false,
        controlAccount: control,
        createdBy: actor.id,
        accountingEntityId: accountingEntity.id,
        ...(entry.header === '500000' ? { behavior: entry.behavior } : {}),
      });
      const uniqueServices = new Set(
        cases.map((candidate) => candidate.service)
      );
      for (const service of uniqueServices) {
        if (service !== entry.service)
          expect(service.createSubAccount).not.toHaveBeenCalled();
      }
      expect(
        mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0][0]
          .allocationHeaderCode
      ).toBe(entry.header);
      expect(result).toMatchObject({
        name: valid.name,
        behavior: entry.behavior,
        subType: entry.subType,
        code: String(Number(entry.header) + 99),
        balance: { amount: 0 },
        functionalBalance: { amount: 0 },
      });
    }
  );
  it('persists creation history in the transaction and publishes both event sets after commit', async () => {
    const result = await usecase(valid);
    const [payload, currency, options] =
      mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0];
    expect(payload).toMatchObject({
      actorId: actor.id,
      allocationHeaderCode: '500000',
      account: {
        name: valid.name,
        controlAccountId: parent.id,
        accountingEntityId: accountingEntity.id,
      },
    });
    expect(currency).toBe('NGN');
    expect(options).toMatchObject({
      correlationId,
      tx,
      history: [
        {
          actorId: actor.id,
          correlationId,
          entityVersion: 1,
          diff: { before: null, after: { name: valid.name } },
        },
      ],
    });
    expect(result.code).toBe('500099');
    expect(result.code).not.toBe(payload.account.code);
    expect(result.materializedPath).toBe(
      `${parent.materializedPath}.${result.code}`
    );
    expect(result.balance).toMatchObject({ amount: 0, currencyCode: 'NGN' });
    const events = mockEventBus.publish.mock.calls[0][0];
    expect(events).toEqual([
      expect.objectContaining({
        correlationId,
        data: expect.objectContaining({ version: 1 }),
      }),
      expect.objectContaining({
        correlationId,
        data: expect.objectContaining({ version: 2, code: result.code }),
      }),
    ]);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
  it('resolves explicit parents within the entity without changing the allocation root', async () => {
    mockLedgerAccountRepo.findByCode.mockClear();
    await usecase({ ...valid, controlAccountId: parent.id });
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      parent.id,
      accountingEntity.id,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0][0]
        .allocationHeaderCode
    ).toBe('500000');
  });
  it('rejects invalid input before reads or transactions', async () => {
    mockLedgerAccountRepo.findByCode.mockClear();
    await expect(usecase({ ...valid, name: '' })).rejects.toBeInstanceOf(
      appError.UnprocessableEntity
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'rejects missing parents before writes (explicit: %s)',
    async (explicit) => {
      mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      await expect(
        usecase({
          ...valid,
          ...(explicit ? { controlAccountId: parent.id } : {}),
        })
      ).rejects.toThrow();
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
  it.each([
    { isControlAccount: false },
    { type: 'equity' },
    { subType: 'other' },
    { accountingEntityId: '123e4567-e89b-42d3-a456-426614174099' },
  ])('preserves domain parent validation for %o', async (override) => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...parent,
      ...override,
    } as ILedgerAccount);
    await expect(
      usecase({ ...valid, controlAccountId: parent.id })
    ).rejects.toBeInstanceOf(ledgerAccountError.InvalidControlAccount);
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('propagates persistence failure without publication', async () => {
    const failure = new Error('persistence failed');
    mockLedgerAccountPersistenceService.createAndAssignCode.mockRejectedValueOnce(
      failure
    );
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('does not publish if commit fails', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementationOnce(async (fn) => {
      await fn(tx);
      throw failure;
    });
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('propagates publication failure after commit without retrying creation', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(committed).toBe(true);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalledTimes(1);
  });
  it.each(['cogs', 'cost_of_services', 'cost_of_revenue'] as const)(
    'rejects %s below the default-direct-cost header',
    async (behavior) => {
      await expect(usecase({ ...valid, behavior })).rejects.toBeInstanceOf(
        ledgerAccountError.InvalidControlAccount
      );
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    }
  );
});
