import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeEmploymentIncomeAccountService from '@domain/ledger/services/revenue-account/employment-income.service';
import makeGainOnAssetSaleAccountService from '@domain/ledger/services/revenue-account/gain-on-sale.service';
import makeGiftsAccountService from '@domain/ledger/services/revenue-account/gifts.service';
import makeGrantsAccountService from '@domain/ledger/services/revenue-account/grants.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import makeUnrealizedGainAccountService from '@domain/ledger/services/revenue-account/unrealized-gain.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import {
  mockEmploymentIncomeAccountService,
  mockGainOnAssetSaleAccountService,
  mockGiftsAccountService,
  mockGrantsAccountService,
  mockServicesAccountService,
  mockUnrealizedGainAccountService,
} from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ICreateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import makeCreateRevenueAccountUsecase from '@app/ledger/usecases/create-revenue-account.usecase';

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
    behavior: 'services',
    header: '401000',
    subType: 'services',
    service: mockServicesAccountService,
  },
  {
    behavior: 'employment_income',
    header: '403000',
    subType: 'employment_income',
    service: mockEmploymentIncomeAccountService,
  },
  {
    behavior: 'gain_on_asset_sale',
    header: '405000',
    subType: 'gain_on_asset_sale',
    service: mockGainOnAssetSaleAccountService,
  },
  {
    behavior: 'unrealized_gains',
    header: '406000',
    subType: 'unrealized_gains',
    service: mockUnrealizedGainAccountService,
  },
  {
    behavior: 'grants',
    header: '407000',
    subType: 'grants',
    service: mockGrantsAccountService,
  },
  {
    behavior: 'gifts',
    header: '408000',
    subType: 'gifts',
    service: mockGiftsAccountService,
  },
] as const;
const usecase = makeCreateRevenueAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  repoService: mockRepoService,
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  servicesAccountService: mockServicesAccountService,
  employmentIncomeAccountService: mockEmploymentIncomeAccountService,
  gainOnAssetSaleAccountService: mockGainOnAssetSaleAccountService,
  unrealizedGainAccountService: mockUnrealizedGainAccountService,
  grantsAccountService: mockGrantsAccountService,
  giftsAccountService: mockGiftsAccountService,
});
const valid: ICreateRevenueAccountDto = {
  name: 'Custom account',
  isControlAccount: false,
  behavior: 'services',
};

describe('createRevenueAccountUsecase', () => {
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
    const services = makeServicesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockServicesAccountService.createHeader.mockImplementation(
      services.createHeader
    );
    mockServicesAccountService.createSubAccount.mockImplementation(
      services.createSubAccount
    );
    const employmentIncome = makeEmploymentIncomeAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockEmploymentIncomeAccountService.createHeader.mockImplementation(
      employmentIncome.createHeader
    );
    mockEmploymentIncomeAccountService.createSubAccount.mockImplementation(
      employmentIncome.createSubAccount
    );
    const gainOnAssetSale = makeGainOnAssetSaleAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockGainOnAssetSaleAccountService.createHeader.mockImplementation(
      gainOnAssetSale.createHeader
    );
    mockGainOnAssetSaleAccountService.createSubAccount.mockImplementation(
      gainOnAssetSale.createSubAccount
    );
    const unrealizedGain = makeUnrealizedGainAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockUnrealizedGainAccountService.createHeader.mockImplementation(
      unrealizedGain.createHeader
    );
    mockUnrealizedGainAccountService.createSubAccount.mockImplementation(
      unrealizedGain.createSubAccount
    );
    const grants = makeGrantsAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockGrantsAccountService.createHeader.mockImplementation(
      grants.createHeader
    );
    mockGrantsAccountService.createSubAccount.mockImplementation(
      grants.createSubAccount
    );
    const gifts = makeGiftsAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockGiftsAccountService.createHeader.mockImplementation(gifts.createHeader);
    mockGiftsAccountService.createSubAccount.mockImplementation(
      gifts.createSubAccount
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
      const control = header;
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
      allocationHeaderCode: '401000',
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
    expect(result.code).toBe('401099');
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
    ).toBe('401000');
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
});
