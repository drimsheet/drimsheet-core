import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import bankDetailsValue from '@domain/ledger/values/bank-details.vo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockAssetAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { IBankAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeCreateBankAccountUseCase from '@app/ledger/usecases/create-bank-account.usecase';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeCreateBankAccountUseCase', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Accounting Entity',
    ownerId: userId,
    type: EAccountingEntityType.PrivateCompany,
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });
  const accountingEntityId = accountingEntity.id;
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  const bankDetails: IBankDetails = bankDetailsValue.make({
    countryCode: 'NG',
    bankName: 'First Bank of Nigeria',
    accountName: 'Company Operating Account',
    accountNumber: '0123456789',
  });

  const validReq: IBankAccountCreationReq = {
    name: 'Operating Bank Account',
    currencyCode: 'NGN',
    bankAccount: {
      bankName: 'First Bank of Nigeria',
      accountName: 'Company Operating Account',
      accountNumber: '0123456789',
    },
    openingBalance: null,
  };

  type TCashAccountResult = Awaited<
    ReturnType<typeof cashAccountService.createBankSubAccount>
  >;
  let mockAccount: TCashAccountResult[0];
  let mockEvents: TCashAccountResult[1];
  let mockAudit: TCashAccountResult[2];
  let mockControlAccount: TCashAccountResult[0];
  let controlAccountId: TEntityId;

  type TJournalEntryResult = ReturnType<typeof journalEntryEntity.make>;
  let mockOpeningBalanceJournalEntry: TJournalEntryResult[0];
  let mockOpeningBalanceEvents: TJournalEntryResult[1];
  let mockOpeningBalanceAudit: TJournalEntryResult[2];

  beforeAll(async () => {
    [mockControlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash and Cash Equivalents',
        accountingEntity,
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      },
      { correlationId: 'test-correlation-id' }
    );
    controlAccountId = mockControlAccount.id;
    [mockAccount, mockEvents, mockAudit] =
      cashAccountService.createBankSubAccount({
        name: validReq.name,
        currency: currencyEntity.getByCode('NGN'),
        isControlAccount: false,
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        controlAccount: mockControlAccount,
        accountingEntity,
        bankDetails,
      });
    [
      mockOpeningBalanceJournalEntry,
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ] = journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
      postedAt: new Date('2026-03-01T00:00:00.000Z'),
      memo: 'Opening balance',
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: mockAccount.id,
          sequenceOrder: 1,
          amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: controlAccountId,
          sequenceOrder: 2,
          amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
  });

  const deps = {
    appContext: mockAppContext,
    eventBus: mockEventBus,
    accountingPeriodService: mockAccountingPeriodService,
    cashAccountService: mockAssetAccountService,
    bankAccountRepo: mockBankAccountRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    journalEntryService: mockJournalEntryService,
    journalEntryPersistenceService: mockJournalEntryPersistenceService,
    outboxService: mockOutboxService,
    ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
    repoService: mockRepoService,
    ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
    fxLotAppService: mockFxLotAppService,
    fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId: 'test-correlation-id',
      accountingEntity,
    } as IAppContextData);
    mockRepoService.runInTransaction.mockImplementation((transactionFn) =>
      transactionFn({} as ITransactionContext)
    );
    mockBankAccountRepo.findOne.mockResolvedValue(null);
    mockLedgerAccountRepo.findByCode.mockResolvedValue(mockControlAccount);
    mockAssetAccountService.createBankSubAccount.mockReturnValue([
      mockAccount,
      mockEvents,
      mockAudit,
    ]);
    mockJournalEntryService.createOpeningBalance.mockResolvedValue([
      mockOpeningBalanceJournalEntry,
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ]);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockBankAccountRepo.create.mockReset().mockResolvedValue();
    mockLedgerAccountPersistenceService.createAndAssignCode
      .mockReset()
      .mockImplementation(async ({ account }) => {
        const [assigned, events] = ledgerAccountEntity.updateCode(
          account,
          '100042'
        );
        return { account: assigned, events };
      });
  });

  it('creates a bank account without opening balance successfully', async () => {
    const useCase = makeCreateBankAccountUseCase(deps);
    const result = await useCase(validReq);

    expect(result.id).toBe(mockAccount.id);
    expect(result.name).toBe(validReq.name);
    expect(result.behavior).toBe('bank');
    expect(result.code).toBe('100042');
    expect(result.materializedPath).toBe(
      `${mockControlAccount.materializedPath}.100042`
    );
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).not.toHaveBeenCalled();
    const [assignmentPayload, , assignmentOptions] =
      mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0];
    expect(assignmentPayload).toEqual({
      account: mockAccount,
      allocationHeaderCode: '100000',
      actorId: actor.id,
    });
    expect(assignmentOptions.history[0].diff.after).toMatchObject({
      code: mockAccount.code,
    });
    expect(mockBankAccountRepo.create.mock.calls[0][4].tx).toBe(
      assignmentOptions.tx
    );
    expect(mockEventBus.publish.mock.calls[0][0]).toEqual([
      ...mockEvents.map((event) =>
        expect.objectContaining({ type: event.type, data: event.data })
      ),
      expect.objectContaining({
        data: expect.objectContaining({ code: '100042', version: 2 }),
      }),
    ]);

    expect(mockBankAccountRepo.findOne).toHaveBeenCalledWith(
      bankDetails.bankName,
      bankDetails.accountNumber,
      expect.anything()
    );
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      accountingEntityId,
      { correlationId: 'test-correlation-id' }
    );
    expect(mockAssetAccountService.createBankSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: mockControlAccount,
      })
    );
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalled();
    expect(mockBankAccountRepo.create).toHaveBeenCalledWith(
      mockAccount.id,
      accountingEntityId,
      bankDetails,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      expect.anything()
    );
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('resolves a supplied control account ID and forwards the resolved account', async () => {
    const selectedControlAccount = {
      ...mockControlAccount,
      code: '100500',
    };
    mockLedgerAccountRepo.findById.mockResolvedValueOnce(
      selectedControlAccount
    );

    const useCase = makeCreateBankAccountUseCase(deps);
    await useCase({
      ...validReq,
      controlAccountId: selectedControlAccount.id,
    });

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      selectedControlAccount.id,
      accountingEntityId,
      { correlationId: 'test-correlation-id' }
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(
      mockAssetAccountService.createBankSubAccount.mock.calls[0][0]
        .controlAccount
    ).toBe(selectedControlAccount);
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockAssetAccountService.createBankSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: selectedControlAccount,
      })
    );
  });

  it('rejects a missing supplied control account before creation', async () => {
    const missingControlAccountId =
      '123e4567-e89b-12d3-a456-426614174009' as TEntityId;
    mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);

    const useCase = makeCreateBankAccountUseCase(deps);
    await expect(
      useCase({ ...validReq, controlAccountId: missingControlAccountId })
    ).rejects.toBeInstanceOf(ledgerAppError.AccountNotFound);

    expect(mockAssetAccountService.createBankSubAccount).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).not.toHaveBeenCalled();
    expect(mockBankAccountRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a missing default control account before creation', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const useCase = makeCreateBankAccountUseCase(deps);
    await expect(useCase(validReq)).rejects.toBeInstanceOf(
      ledgerAccountError.ControlAccountNotFound
    );

    expect(mockAssetAccountService.createBankSubAccount).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).not.toHaveBeenCalled();
    expect(mockBankAccountRepo.create).not.toHaveBeenCalled();
  });

  it('creates a bank account with opening balance in functional currency', async () => {
    const reqWithOpeningBalance: IBankAccountCreationReq = {
      ...validReq,
      openingBalance: {
        amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        date: new Date('2026-03-01T00:00:00.000Z'),
      },
    };

    const useCase = makeCreateBankAccountUseCase(deps);
    const result = await useCase(reqWithOpeningBalance);

    expect(result.id).toBe(mockAccount.id);
    expect(result.code).toBe('100042');
    const writeOptions =
      mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0][2];
    expect(writeOptions.history).toHaveLength(2);
    expect(mockBankAccountRepo.create.mock.calls[0][4].tx).toBe(
      writeOptions.tx
    );
    expect(mockJournalEntryPersistenceService.create.mock.calls[0][3].tx).toBe(
      writeOptions.tx
    );
    expect(mockEventBus.publish.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ code: '100042', version: 3 }),
        }),
      ])
    );
    expect(result.openingBalanceDate).toEqual(
      reqWithOpeningBalance.openingBalance?.date
    );
    expect(mockJournalEntryService.createOpeningBalance).toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalled();
    expect(mockBankAccountRepo.create).toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      mockOpeningBalanceJournalEntry.id,
      expect.objectContaining({
        correlationId: 'test-correlation-id',
        tx: expect.anything(),
      })
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: mockOpeningBalanceJournalEntry.id,
      correlationId: 'test-correlation-id',
    });
    expect(
      mockRepoService.runInTransaction.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('persists a non-posted opening-balance journal without queueing balance work', async () => {
    const reqWithOpeningBalance: IBankAccountCreationReq = {
      ...validReq,
      openingBalance: {
        amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        date: new Date('2026-03-01T00:00:00.000Z'),
      },
    };
    mockJournalEntryService.createOpeningBalance.mockResolvedValueOnce([
      {
        ...mockOpeningBalanceJournalEntry,
        status: EJournalEntryStatus.Draft,
      },
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ]);

    const useCase = makeCreateBankAccountUseCase(deps);
    await useCase(reqWithOpeningBalance);

    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('creates a bank account with opening balance in foreign currency and persists FX acquisition data', async () => {
    const openingBalanceDate = new Date('2026-03-01T00:00:00.000Z');
    const exchangeRate = exchangeRateValue.make({
      baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
      targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      rate: 1500,
      type: EExchangeRateType.Market,
      source: 'manual',
      asOf: openingBalanceDate,
    });
    const foreignReq: IBankAccountCreationReq = {
      name: 'USD Bank Account',
      currencyCode: 'USD',
      bankAccount: {
        bankName: 'Bank of America',
        accountName: 'US Operating Account',
        accountNumber: '9876543210',
      },
      openingBalance: {
        amount: { amount: 5000, currencyCode: 'USD', isMinorUnit: true },
        exchangeRate,
        date: openingBalanceDate,
      },
    };

    const [foreignMockAccount] = cashAccountService.createBankSubAccount({
      name: foreignReq.name,
      currency: currencyEntity.getByCode('USD'),
      isControlAccount: false,
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      controlAccount: mockControlAccount,
      accountingEntity,
      bankDetails: bankDetailsValue.make({
        countryCode: 'NG',
        bankName: foreignReq.bankAccount.bankName,
        accountName: foreignReq.bankAccount.accountName,
        accountNumber: foreignReq.bankAccount.accountNumber,
      }),
    });

    mockAssetAccountService.createBankSubAccount.mockReturnValueOnce([
      foreignMockAccount,
      [],
      mockAudit,
    ]);

    const [
      mockForeignJournalEntry,
      mockForeignJournalEvents,
      mockForeignJournalAudit,
    ] = journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: openingBalanceDate,
      postedAt: openingBalanceDate,
      memo: 'Opening balance',
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: foreignMockAccount.id,
          sequenceOrder: 1,
          amount: { amount: 5000n, currency: SYSTEM_CURRENCIES.USD },
          exchangeRate,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: mockOpeningBalanceJournalEntry.lines[1].accountId,
          sequenceOrder: 2,
          amount: { amount: 7500000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    mockJournalEntryService.createOpeningBalance.mockResolvedValueOnce([
      mockForeignJournalEntry,
      mockForeignJournalEvents,
      mockForeignJournalAudit,
    ]);

    const lotId = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
    const acqId = '123e4567-e89b-12d3-a456-426614174098' as TEntityId;
    const mockLotData = {
      lot: [
        { id: lotId },
        [
          {
            type: 'fx_cost_basis_lot_created',
            data: {},
            occurredAt: new Date(),
          },
        ],
        {
          entityId: lotId,
          action: 'create',
          diff: { before: null, after: { id: lotId } },
          occurredAt: new Date(),
        },
      ],
      acquisition: [
        { id: acqId },
        [
          {
            type: 'fx_cost_basis_lot_acquisition_created',
            data: {},
            occurredAt: new Date(),
          },
        ],
        {
          entityId: acqId,
          action: 'create',
          diff: { before: null, after: { id: acqId } },
          occurredAt: new Date(),
        },
      ],
    };
    const fxRecords = {
      lot: mockLotData.lot[0],
      acquisition: mockLotData.acquisition[0],
      lotHistory: { entityId: lotId },
      acquisitionHistory: { entityId: acqId },
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockFxLotAppService.acquire.mockResolvedValueOnce({
      records: fxRecords,
      events: [],
    });

    const useCase = makeCreateBankAccountUseCase(deps);
    const result = await useCase(foreignReq);

    expect(result.id).toBe(foreignMockAccount.id);
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: expect.anything(),
        account: expect.objectContaining({ id: foreignMockAccount.id }),
        actor: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      },
      { correlationId: 'test-correlation-id' }
    );
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId: 'test-correlation-id' })
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('rejects duplicate bank account across entities', async () => {
    mockBankAccountRepo.findOne.mockResolvedValueOnce(bankDetails);

    const useCase = makeCreateBankAccountUseCase(deps);
    await expect(useCase(validReq)).rejects.toBeInstanceOf(
      ledgerAccountError.DuplicateBankAccount
    );
  });

  it('rejects when opening balance date is not covered by open accounting period', async () => {
    mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
      new periodError.PostingPeriodNotOpen({
        accountingEntityId,
        postingDate: new Date('2026-03-01T00:00:00.000Z'),
      })
    );

    const reqWithOpeningBalance: IBankAccountCreationReq = {
      ...validReq,
      openingBalance: {
        amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        date: new Date('2026-03-01T00:00:00.000Z'),
      },
    };

    const useCase = makeCreateBankAccountUseCase(deps);
    await expect(useCase(reqWithOpeningBalance)).rejects.toBeInstanceOf(
      periodError.PostingPeriodNotOpen
    );
  });

  it('does not propagate balance or publish events when transaction fails during opening balance creation', async () => {
    const failure = new Error('transaction failure');
    mockRepoService.runInTransaction.mockRejectedValueOnce(failure);

    const reqWithOpeningBalance: IBankAccountCreationReq = {
      ...validReq,
      openingBalance: {
        amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        date: new Date('2026-03-01T00:00:00.000Z'),
      },
    };

    const useCase = makeCreateBankAccountUseCase(deps);
    await expect(useCase(reqWithOpeningBalance)).rejects.toBe(failure);

    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'suppresses post-commit work when bank details fail (opening balance: %s)',
    async (withOpeningBalance) => {
      const failure = new ledgerAccountError.DuplicateBankAccount({
        details: bankDetails,
      });
      mockBankAccountRepo.create.mockRejectedValueOnce(failure);
      const payload: IBankAccountCreationReq = {
        ...validReq,
        openingBalance: withOpeningBalance
          ? {
              amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
              exchangeRate: null,
              date: new Date('2026-03-01T00:00:00.000Z'),
            }
          : null,
      };
      await expect(makeCreateBankAccountUseCase(deps)(payload)).rejects.toBe(
        failure
      );
      expect(
        mockLedgerAccountPersistenceService.createAndAssignCode
      ).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
      expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('waits for the outer commit before publishing no-opening-balance events', async () => {
    let commit!: () => void;
    let prepared!: () => void;
    const ready = new Promise<void>((resolve) => {
      prepared = resolve;
    });
    const committed = new Promise<void>((resolve) => {
      commit = resolve;
    });
    mockRepoService.runInTransaction.mockImplementationOnce(async (fn) => {
      const result = await fn({});
      prepared();
      await committed;
      return result;
    });
    const creation = makeCreateBankAccountUseCase(deps)(validReq);
    await ready;
    expect(mockBankAccountRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    commit();
    await creation;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('does not insert bank details when assignment fails', async () => {
    const failure = new ledgerAccountError.MaximumLimitReached({
      predecessorCode: '100999',
    });
    mockLedgerAccountPersistenceService.createAndAssignCode.mockRejectedValueOnce(
      failure
    );
    await expect(makeCreateBankAccountUseCase(deps)(validReq)).rejects.toBe(
      failure
    );
    expect(mockBankAccountRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
