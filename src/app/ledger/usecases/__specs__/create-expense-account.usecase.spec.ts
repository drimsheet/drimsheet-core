import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
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

let creation: ReturnType<typeof ledgerAccountEntity.make<ILedgerAccount>>;
function makeAccount(
  scenario: (typeof cases)[number],
  status: 'active' | 'draft' = 'active'
) {
  return ledgerAccountEntity.make<ILedgerAccount>({
    name: valid.name,
    code: scenario.header.slice(0, 3) + '099',
    materializedPath:
      scenario.header + '.' + scenario.header.slice(0, 3) + '099',
    accountingEntityId: accountingEntity.id,
    createdBy: actor.id,
    type: 'expense',
    subType: scenario.subType,
    behavior: scenario.behavior,
    normalBalance: 'debit',
    isControlAccount: false,
    controlAccountId: actor.id,
    currency: null,
    status,
    meta: null,
    contraAccountRule: 'contra_not_permitted',
    adjunctAccountRule: 'adjunct_not_permitted',
  });
}

describe('complete expense creation workflow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    creation = makeAccount(cases[0]);
    mockDirectCostsAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockDirectCostsAccountService.createSubAccount>
        >
    );
    mockRentAndUtilitiesAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockRentAndUtilitiesAccountService.createSubAccount>
        >
    );
    mockBankChargeAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockBankChargeAccountService.createSubAccount>
        >
    );
    mockFinanceCostAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockFinanceCostAccountService.createSubAccount>
        >
    );
    mockInterestAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockInterestAccountService.createSubAccount>
        >
    );
    mockTaxExpenseAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockTaxExpenseAccountService.createSubAccount>
        >
    );
    mockUnrealizedLossAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<typeof mockUnrealizedLossAccountService.createSubAccount>
        >
    );
    mockAssetDisposalLossAccountService.createSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<
            typeof mockAssetDisposalLossAccountService.createSubAccount
          >
        >
    );
  });
  it.each(
    cases.flatMap((scenario) =>
      ([undefined, 'active', 'draft'] as const).map((status) => ({
        ...scenario,
        status,
      }))
    )
  )(
    'stores the final version 1 account and one creation history for $behavior ($status)',
    async (scenario) => {
      creation = makeAccount(scenario, scenario.status);
      const response = await usecase({
        ...valid,
        behavior: scenario.behavior,
        status: scenario.status,
      });
      const [account, functionalCurrency, writeOptions] =
        mockLedgerAccountPersistenceService.create.mock.calls[0];
      expect(scenario.service.createSubAccount).toHaveBeenCalledWith(
        expect.objectContaining({ status: scenario.status }),
        expect.objectContaining({ tx: mockRepoTransaction.context })
      );
      expect(account).toBe(creation[0]);
      expect(account.version).toBe(1);
      expect(account.status).toBe(scenario.status ?? 'active');
      expect(functionalCurrency).toBe(accountingEntity.functionalCurrencyCode);
      expect(writeOptions).toMatchObject({
        correlationId,
        tx: mockRepoTransaction.context,
      });
      expect(writeOptions.history).toHaveLength(1);
      expect(writeOptions.history[0].diff).toMatchObject({
        before: null,
        after: JSON.parse(JSON.stringify(account)),
      });
      expect(response).toMatchObject({
        id: account.id,
        status: account.status,
        code: account.code,
        materializedPath: account.materializedPath,
      });
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish.mock.calls[0][0]).toEqual([
        expect.objectContaining({
          correlationId,
          data: expect.objectContaining({ version: 1, code: account.code }),
        }),
      ]);
    }
  );
  it('passes an optional parent ID and the caller transaction to the domain', async () => {
    await usecase({ ...valid, controlAccountId: actor.id });
    expect(mockDirectCostsAccountService.createSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccountId: actor.id,
        createdBy: actor.id,
        accountingEntityId: accountingEntity.id,
      }),
      { correlationId, tx: mockRepoTransaction.context }
    );
  });
  it('rejects malformed requests before acquiring a transaction', async () => {
    await expect(usecase({ ...valid, name: '' })).rejects.toBeInstanceOf(
      appError.UnprocessableEntity
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it('propagates acquisition failure without using or disposing a context', async () => {
    const failure = new Error('acquisition failed');
    mockRepoService.createTransaction.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
  });
  it.each(['creation', 'write', 'commit'] as const)(
    'cleans up after %s failure without publishing',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'creation')
        mockDirectCostsAccountService.createSubAccount.mockRejectedValueOnce(
          failure
        );
      if (stage === 'write')
        mockLedgerAccountPersistenceService.create.mockRejectedValueOnce(
          failure
        );
      if (stage === 'commit')
        mockRepoTransaction.commit.mockRejectedValueOnce(failure);
      await expect(usecase(valid)).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
  it('preserves committed state when publication rejects and does not retry writes', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountPersistenceService.create).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
  });
});
