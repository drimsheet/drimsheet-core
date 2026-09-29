import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import { REVENUE_LEDGER_CODES } from '@domain/ledger/config/revenue-codes.config';
import makeReceivablesAccountService from '@domain/ledger/services/asset-account/receivables-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import {
  mockAssetDisposalLossAccountService,
  mockBankChargeAccountService,
  mockDirectCostsAccountService,
  mockEmploymentIncomeAccountService,
  mockFinanceCostAccountService,
  mockGainOnAssetSaleAccountService,
  mockGiftsAccountService,
  mockGrantsAccountService,
  mockInterestAccountService,
  mockPayablesAccountService,
  mockReceivablesAccountService,
  mockRentAndUtilitiesAccountService,
  mockServicesAccountService,
  mockTaxExpenseAccountService,
  mockUnrealizedGainAccountService,
  mockUnrealizedLossAccountService,
} from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makePostingAccountBootstrapService from '@app/ledger/services/posting-account-bootstrap.service';

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
  ownerId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  type: EAccountingEntityType.Individual,
  functionalCurrencyCode: 'USD',
} as IAccountingEntity;
const repoOptions: IReadRepoOptions = {
  correlationId: 'test-correlation-id',
};
const expectedAccountNames = [
  'Trade Receivables',
  'Statutory Receivables',
  'Statutory Receivables (Default)',
  'Trade Payables',
  'Statutory Payables',
  'Statutory Payables (Default)',
  'Services (Default)',
  'Employment Income (Default)',
  'Gain on Sale of Assets (Default)',
  'Unrealized Gains (Default)',
  'Grants (Default)',
  'Gifts (Default)',
  'Direct Costs (Default)',
  'Rent and Utilities (Default)',
  'Bank Charge (Default)',
  'Finance Cost (Default)',
  'Interest (Default)',
  'Tax Expense (Default)',
  'Unrealized Loss (Default)',
  'Asset Disposal Loss (Default)',
];

function makeAuditedAccount(
  name: string,
  index: number
): TAuditedEntity<ILedgerAccount, ILedgerAccount, ILedgerAccount> {
  const account = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: `123e4567-e89b-12d3-a456-4266141740${String(index).padStart(2, '0')}` as TEntityId,
    name,
  } as ILedgerAccount;
  const occurredAt = new Date('2026-01-01T00:00:00.000Z');

  return [
    account,
    [{ type: `${name}-created`, data: account, occurredAt, enrichedAt: null }],
    {
      entityId: account.id,
      entityVersion: 1,
      action: 'created',
      diff: { before: null, after: account },
      occurredAt,
    },
  ];
}

const dependencies = {
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  receivablesAccountService: mockReceivablesAccountService,
  payablesAccountService: mockPayablesAccountService,
  servicesAccountService: mockServicesAccountService,
  employmentIncomeAccountService: mockEmploymentIncomeAccountService,
  gainOnAssetSaleAccountService: mockGainOnAssetSaleAccountService,
  unrealizedGainAccountService: mockUnrealizedGainAccountService,
  grantsAccountService: mockGrantsAccountService,
  giftsAccountService: mockGiftsAccountService,
  directCostsAccountService: mockDirectCostsAccountService,
  rentAndUtilitiesAccountService: mockRentAndUtilitiesAccountService,
  bankChargeAccountService: mockBankChargeAccountService,
  financeCostAccountService: mockFinanceCostAccountService,
  interestAccountService: mockInterestAccountService,
  taxExpenseAccountService: mockTaxExpenseAccountService,
  unrealizedLossAccountService: mockUnrealizedLossAccountService,
  assetDisposalLossAccountService: mockAssetDisposalLossAccountService,
};

describe('postingAccountBootstrapService', () => {
  const service = makePostingAccountBootstrapService(dependencies);
  const auditedAccounts = expectedAccountNames.map(makeAuditedAccount);

  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findByCode.mockImplementation(
      async (code) => ({ code }) as ILedgerAccount
    );
    mockReceivablesAccountService.createTradeReceivableSubAccount.mockReturnValue(
      auditedAccounts[0] as never
    );
    mockReceivablesAccountService.createStatutoryReceivableSubAccount
      .mockReturnValueOnce(auditedAccounts[1] as never)
      .mockReturnValueOnce(auditedAccounts[2] as never);
    mockPayablesAccountService.createTradePayableSubAccount.mockReturnValue(
      auditedAccounts[3] as never
    );
    mockPayablesAccountService.createStatutoryPayableSubAccount
      .mockReturnValueOnce(auditedAccounts[4] as never)
      .mockReturnValueOnce(auditedAccounts[5] as never);
    mockServicesAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[6] as never
    );
    mockEmploymentIncomeAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[7] as never
    );
    mockGainOnAssetSaleAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[8] as never
    );
    mockUnrealizedGainAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[9] as never
    );
    mockGrantsAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[10] as never
    );
    mockGiftsAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[11] as never
    );
    mockDirectCostsAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[12] as never
    );
    mockRentAndUtilitiesAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[13] as never
    );
    mockBankChargeAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[14] as never
    );
    mockFinanceCostAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[15] as never
    );
    mockInterestAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[16] as never
    );
    mockTaxExpenseAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[17] as never
    );
    mockUnrealizedLossAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[18] as never
    );
    mockAssetDisposalLossAccountService.createSubAccount.mockReturnValue(
      auditedAccounts[19] as never
    );
    mockLedgerAccountPersistenceService.create.mockResolvedValue();
  });

  it('owns and bootstraps the complete posting catalog in dependency order', async () => {
    const result = await service.bootstrap(
      accountingEntity,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      repoOptions
    );

    expect(result.entries.map(({ account }) => account.name)).toEqual(
      expectedAccountNames
    );
    expect(result.events.map(({ type }) => type)).toEqual(
      expectedAccountNames.map((name) => `${name}-created`)
    );
    expect(mockLedgerAccountPersistenceService.create).toHaveBeenCalledTimes(
      expectedAccountNames.length
    );
    expect(
      mockLedgerAccountPersistenceService.create.mock.calls.map(
        ([account]) => account.name
      )
    ).toEqual(expectedAccountNames);
    expect(
      mockLedgerAccountPersistenceService.create.mock.calls.every(
        ([, currencyCode, options]) =>
          currencyCode === accountingEntity.functionalCurrencyCode &&
          options.correlationId === repoOptions.correlationId &&
          options.history.length === 1
      )
    ).toBe(true);
  });

  it('persists each prerequisite before creating its dependent account', async () => {
    await service.bootstrap(
      accountingEntity,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      repoOptions
    );

    expect(
      mockLedgerAccountPersistenceService.create.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockReceivablesAccountService.createStatutoryReceivableSubAccount.mock
        .invocationCallOrder[0]
    );
    expect(
      mockLedgerAccountPersistenceService.create.mock.invocationCallOrder[1]
    ).toBeLessThan(
      mockReceivablesAccountService.createStatutoryReceivableSubAccount.mock
        .invocationCallOrder[1]
    );
    expect(
      mockLedgerAccountPersistenceService.create.mock.invocationCallOrder[3]
    ).toBeLessThan(
      mockPayablesAccountService.createStatutoryPayableSubAccount.mock
        .invocationCallOrder[0]
    );
    expect(
      mockLedgerAccountPersistenceService.create.mock.invocationCallOrder[4]
    ).toBeLessThan(
      mockPayablesAccountService.createStatutoryPayableSubAccount.mock
        .invocationCallOrder[1]
    );
  });

  it('supplies the configured control accounts for every ledger family', async () => {
    await service.bootstrap(
      accountingEntity,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      repoOptions
    );

    expect(
      mockReceivablesAccountService.createTradeReceivableSubAccount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: expect.objectContaining({
          code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
        }),
      })
    );
    expect(
      mockPayablesAccountService.createTradePayableSubAccount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: expect.objectContaining({
          code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
        }),
      })
    );
    expect(mockServicesAccountService.createSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: expect.objectContaining({
          code: REVENUE_LEDGER_CODES.SERVICES.HEADER,
        }),
      })
    );
    expect(mockDirectCostsAccountService.createSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: expect.objectContaining({
          code: EXPENSE_LEDGER_CODES.DIRECT_COSTS.HEADER,
        }),
      })
    );
  });

  it('stops immediately when persistence fails', async () => {
    const persistenceFailure = new Error('posting persistence failed');
    mockLedgerAccountPersistenceService.create.mockRejectedValueOnce(
      persistenceFailure
    );

    await expect(
      service.bootstrap(
        accountingEntity,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        repoOptions
      )
    ).rejects.toBe(persistenceFailure);
    expect(
      mockReceivablesAccountService.createStatutoryReceivableSubAccount
    ).not.toHaveBeenCalled();
  });

  it('propagates domain failures without continuing', async () => {
    const domainFailure = new Error('allocation failed');
    mockServicesAccountService.createSubAccount.mockImplementationOnce(() => {
      throw domainFailure;
    });

    await expect(
      service.bootstrap(
        accountingEntity,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        repoOptions
      )
    ).rejects.toBe(domainFailure);
    expect(
      mockEmploymentIncomeAccountService.createSubAccount
    ).not.toHaveBeenCalled();
  });

  it('rejects before domain creation when the required header is not persisted', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const realReceivablesService = makeReceivablesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    const serviceWithoutHeader = makePostingAccountBootstrapService({
      ...dependencies,
      receivablesAccountService: realReceivablesService,
    });

    await expect(
      serviceWithoutHeader.bootstrap(
        accountingEntity,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_account_control_account_not_found_unexpected',
      cause: {
        controlAccountLedgerCode: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      },
    });
    expect(mockLedgerAccountPersistenceService.create).not.toHaveBeenCalled();
  });
});
