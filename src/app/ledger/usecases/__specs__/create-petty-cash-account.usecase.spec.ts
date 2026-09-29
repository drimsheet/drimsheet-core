import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
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
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockAssetAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { IPettyCashAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeCreatePettyCashAccountUseCase from '@app/ledger/usecases/create-petty-cash-account.usecase';
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

describe('createPettyCashSubAccountUseCase', () => {
  const correlationId = 'test-corr-id';

  const mockUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    email: 'test@example.com',
  } as IUser;

  const [mockAccountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Accounting Entity',
    ownerId: mockUser.id,
    type: EAccountingEntityType.Individual,
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });

  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  const validPayload: IPettyCashAccountCreationReq = {
    name: 'Petty Cash',
    currencyCode: 'NGN',
    openingBalance: {
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-03-14T00:00:00.000Z'),
    },
    isControlAccount: false,
  };
  const validOpeningBalance = validPayload.openingBalance!;

  type TCashAccountResult = Awaited<
    ReturnType<typeof cashAccountService.createPettyCashSubAccount>
  >;
  let mockControlAccount: TCashAccountResult[0];
  let mockPettyCashAccount: TCashAccountResult[0];
  let mockEvents: TCashAccountResult[1];
  let mockPettyCashAudit: TCashAccountResult[2];

  type TJournalEntryResult = ReturnType<typeof journalEntryEntity.make>;
  let mockOpeningBalanceJournalEntry: TJournalEntryResult[0];
  let mockOpeningBalanceEvents: TJournalEntryResult[1];
  let mockOpeningBalanceAudit: TJournalEntryResult[2];

  beforeAll(async () => {
    [mockControlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash and Equivalents',
        accountingEntity: mockAccountingEntity,
        createdBy: mockUser.actorId,
      },
      { correlationId }
    );
    [mockPettyCashAccount, mockEvents, mockPettyCashAudit] =
      cashAccountService.createPettyCashSubAccount({
        name: validPayload.name,
        currency: SYSTEM_CURRENCIES.NGN,
        isControlAccount: false,
        createdBy: mockUser.actorId,
        controlAccount: mockControlAccount,
        accountingEntity: mockAccountingEntity,
      });
    [
      mockOpeningBalanceJournalEntry,
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ] = journalEntryEntity.make({
      accountingEntityId: mockAccountingEntity.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: validOpeningBalance.date,
      postedAt: validOpeningBalance.date,
      memo: 'Opening balance',
      createdBy: mockUser.actorId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: mockPettyCashAccount.id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: mockControlAccount.id,
          sequenceOrder: 2,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    mockOutboxService.createBalancePropagation.mockReset().mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockReset().mockResolvedValue();

    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      clientSession: mockClientSession,
      accountingEntity: mockAccountingEntity,
    } as unknown as IAppContextData);

    mockLedgerAccountRepo.findByCode.mockResolvedValue(mockControlAccount);
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
    mockAssetAccountService.createPettyCashSubAccount.mockReturnValue([
      mockPettyCashAccount,
      mockEvents,
      mockPettyCashAudit,
    ]);
    mockJournalEntryService.createOpeningBalance.mockResolvedValue([
      mockOpeningBalanceJournalEntry,
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ]);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockLedgerAccountPersistenceService.createAndAssignCode
      .mockReset()
      .mockImplementation(async ({ account }) => ({ account, events: [] }));
  });

  const getUseCase = () =>
    makeCreatePettyCashAccountUseCase({
      appContext: mockAppContext,
      eventBus: mockEventBus,
      cashAccountService: mockAssetAccountService,
      ledgerAccountRepo: mockLedgerAccountRepo,
      accountingPeriodService: mockAccountingPeriodService,
      journalEntryService: mockJournalEntryService,
      journalEntryPersistenceService: mockJournalEntryPersistenceService,
      outboxService: mockOutboxService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      repoService: mockRepoService,
      ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
      fxLotAppService: mockFxLotAppService,
      fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
    });

  it('should successfully create a petty cash sub-account and record opening balance', async () => {
    const useCase = getUseCase();

    const result = await useCase(validPayload);

    expect(result).toMatchObject({
      id: mockPettyCashAccount.id,
      openingBalanceDate: validOpeningBalance.date,
      balance: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      functionalBalance: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
    });

    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).toHaveBeenCalledWith(mockAccountingEntity.id, validOpeningBalance.date, {
      correlationId,
    });

    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        name: validPayload.name,
        currency: SYSTEM_CURRENCIES.NGN,
        isControlAccount: false,
        createdBy: mockUser.actorId,
        accountingEntity: mockAccountingEntity,
        controlAccount: mockControlAccount,
      })
    );
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      mockAccountingEntity.id,
      { correlationId }
    );

    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledWith(
      mockOpeningBalanceJournalEntry,
      expect.objectContaining({
        entityId: mockOpeningBalanceJournalEntry.id,
        correlationId,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          correlationId,
        }),
      ]),
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      mockOpeningBalanceJournalEntry.id,
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: mockOpeningBalanceJournalEntry.id,
      correlationId,
    });
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

    await getUseCase()({
      ...validPayload,
      controlAccountId: selectedControlAccount.id,
    });

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      selectedControlAccount.id,
      mockAccountingEntity.id,
      { correlationId }
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(
      mockAssetAccountService.createPettyCashSubAccount.mock.calls[0][0]
        .controlAccount
    ).toBe(selectedControlAccount);
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccount: selectedControlAccount,
      })
    );
  });

  it('rejects a missing supplied control account before creation', async () => {
    const missingControlAccountId =
      '123e4567-e89b-12d3-a456-426614174009' as TEntityId;
    mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);

    await expect(
      getUseCase()({
        ...validPayload,
        controlAccountId: missingControlAccountId,
      })
    ).rejects.toBeInstanceOf(ledgerAppError.AccountNotFound);

    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).not.toHaveBeenCalled();
  });

  it('rejects a missing default control account before creation', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    await expect(getUseCase()(validPayload)).rejects.toBeInstanceOf(
      ledgerAccountError.ControlAccountNotFound
    );

    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).not.toHaveBeenCalled();
  });

  it('should successfully create a petty cash sub-account without opening balance', async () => {
    const useCase = getUseCase();

    const result = await useCase({ ...validPayload, openingBalance: null });

    expect(result).toMatchObject({
      id: mockPettyCashAccount.id,
      balance: {
        amount: 0,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      functionalBalance: {
        amount: 0,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
    });

    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('persists a non-posted opening-balance journal without queueing balance work', async () => {
    mockJournalEntryService.createOpeningBalance.mockResolvedValueOnce([
      {
        ...mockOpeningBalanceJournalEntry,
        status: EJournalEntryStatus.Draft,
      },
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ]);

    await getUseCase()(validPayload);

    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('does not allocate or persist when posting-period validation fails', async () => {
    const failure = new Error('posting period is closed');
    mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
      failure
    );

    await expect(getUseCase()(validPayload)).rejects.toBe(failure);
    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not run post-commit work when the transaction fails', async () => {
    const failure = new Error('transaction failed');
    mockRepoService.runInTransaction.mockRejectedValueOnce(failure);

    await expect(getUseCase()(validPayload)).rejects.toBe(failure);
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits event publication after the transaction commits', async () => {
    let finishPublication: (() => void) | undefined;
    mockEventBus.publish.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishPublication = resolve;
      })
    );

    let settled = false;
    const creation = getUseCase()({ ...validPayload, openingBalance: null });
    void creation.then(() => {
      settled = true;
    });
    await new Promise(process.nextTick);

    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(settled).toBe(false);

    finishPublication?.();
    await creation;
    expect(settled).toBe(true);
  });

  it('propagates an invalid supplied parent before persistence', async () => {
    const useCase = getUseCase();

    mockAssetAccountService.createPettyCashSubAccount.mockImplementation(() => {
      throw new ledgerAccountError.InvalidControlAccount();
    });

    await expect(useCase(validPayload)).rejects.toThrow(
      ledgerAccountError.InvalidControlAccount
    );
  });

  it('should validate payload before proceeding', async () => {
    const useCase = getUseCase();

    await expect(
      useCase({
        ...validPayload,
        name: '',
      })
    ).rejects.toThrow();
  });

  it('propagates synchronous domain errors without a user context', async () => {
    const useCase = getUseCase();

    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      clientSession: mockClientSession,
      accountingEntity: mockAccountingEntity,
    } as unknown as IAppContextData);

    mockAssetAccountService.createPettyCashSubAccount.mockImplementation(() => {
      throw new ledgerAccountError.InvalidName();
    });

    await expect(useCase(validPayload)).rejects.toThrow(
      ledgerAccountError.InvalidName
    );
  });

  it('should create and persist FX acquisition data when currency is foreign and exchange rate is provided', async () => {
    const foreignPayload: IPettyCashAccountCreationReq = {
      ...validPayload,
      currencyCode: 'USD',
      openingBalance: {
        amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
        exchangeRate: {
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: 1500,
          type: 'market' as any,
          source: 'manual',
          asOf: new Date('2026-03-14T00:00:00.000Z'),
        },
        date: new Date('2026-03-14T00:00:00.000Z'),
      },
    };

    const [foreignPettyCashAccount] =
      cashAccountService.createPettyCashSubAccount({
        name: foreignPayload.name,
        currency: SYSTEM_CURRENCIES.USD,
        isControlAccount: false,
        createdBy: mockUser.actorId,
        controlAccount: mockControlAccount,
        accountingEntity: mockAccountingEntity,
      });

    mockAssetAccountService.createPettyCashSubAccount.mockReturnValueOnce([
      foreignPettyCashAccount,
      mockEvents,
      mockPettyCashAudit,
    ]);

    const mockForeignJournalEntry = {
      ...mockOpeningBalanceJournalEntry,
      lines: [
        {
          accountId: foreignPettyCashAccount.id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.USD },
          functionalAmount: {
            amount: 1500000n,
            currency: SYSTEM_CURRENCIES.NGN,
          },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    };
    mockJournalEntryService.createOpeningBalance.mockResolvedValueOnce([
      mockForeignJournalEntry as any,
      mockOpeningBalanceEvents,
      mockOpeningBalanceAudit,
    ]);

    const mockLotData = {
      lot: [
        { id: '123e4567-e89b-12d3-a456-426614174099' as TEntityId },
        [
          {
            type: 'fx_cost_basis_lot_created',
            data: {},
            occurredAt: new Date(),
          },
        ],
        {
          entityId: '123e4567-e89b-12d3-a456-426614174099' as TEntityId,
          action: 'create',
          diff: {
            before: null,
            after: { id: '123e4567-e89b-12d3-a456-426614174099' },
          },
          occurredAt: new Date(),
        },
      ],
      acquisition: [
        { id: '123e4567-e89b-12d3-a456-426614174098' as TEntityId },
        [
          {
            type: 'fx_cost_basis_lot_acquisition_created',
            data: {},
            occurredAt: new Date(),
          },
        ],
        {
          entityId: '123e4567-e89b-12d3-a456-426614174098' as TEntityId,
          action: 'create',
          diff: {
            before: null,
            after: { id: '123e4567-e89b-12d3-a456-426614174098' },
          },
          occurredAt: new Date(),
        },
      ],
    };
    const fxRecords = {
      lot: mockLotData.lot[0],
      acquisition: mockLotData.acquisition[0],
      lotHistory: {
        entityId: '123e4567-e89b-12d3-a456-426614174099' as TEntityId,
      },
      acquisitionHistory: {
        entityId: '123e4567-e89b-12d3-a456-426614174098' as TEntityId,
      },
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockFxLotAppService.acquire.mockResolvedValueOnce({
      records: fxRecords,
      events: [],
    });

    const useCase = getUseCase();
    await useCase(foreignPayload);

    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: expect.anything(),
        account: expect.objectContaining({ currency: SYSTEM_CURRENCIES.USD }),
        actor: mockUser.actorId,
      },
      { correlationId }
    );
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId })
    );
  });

  it.each([false, true])(
    'returns and publishes the final assigned account (opening: %s)',
    async (withOpening) => {
      mockLedgerAccountPersistenceService.createAndAssignCode.mockImplementationOnce(
        async ({ account }) => {
          const [updated, events] = ledgerAccountEntity.updateCode(
            account,
            '100123'
          );
          return { account: updated, events };
        }
      );
      const result = await getUseCase()({
        ...validPayload,
        openingBalance: withOpening ? validOpeningBalance : null,
      });
      expect(result).toMatchObject({
        id: mockPettyCashAccount.id,
        code: '100123',
        materializedPath: '100000.100123',
      });
      expect(
        mockLedgerAccountPersistenceService.createWithoutAssigningCode
      ).not.toHaveBeenCalled();
      const [assignmentPayload, currencyCode, options] =
        mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0];
      expect(assignmentPayload).toMatchObject({
        allocationHeaderCode: '100000',
        actorId: actor.id,
        account: expect.objectContaining({ id: mockPettyCashAccount.id }),
      });
      expect(currencyCode).toBe('NGN');
      expect(options).toMatchObject({ correlationId, tx: 'mock-tx' });
      expect(options.history).toHaveLength(withOpening ? 2 : 1);
      expect(options.history[0]).toMatchObject({
        entityId: mockPettyCashAccount.id,
        actorId: actor.id,
        correlationId,
        diff: {
          before: null,
          after: {
            id: mockPettyCashAccount.id,
            code: mockPettyCashAccount.code,
            version: 1,
          },
        },
      });
      if (withOpening) {
        expect(options.history[1].diff.after.openingBalanceDate).toBe(
          validOpeningBalance.date.toISOString()
        );
      }
      expect(Boolean(assignmentPayload.account.openingBalanceDate)).toBe(
        withOpening
      );
      const published = mockEventBus.publish.mock.calls[0][0];
      if (!Array.isArray(published)) throw new Error('Expected an event batch');
      expect(published[0].data).toEqual(mockPettyCashAccount);
      if (withOpening) {
        expect(published[1].data).toMatchObject({
          code: mockPettyCashAccount.code,
          openingBalanceDate: validOpeningBalance.date,
          version: 2,
        });
      }
      expect(published.slice(withOpening ? 2 : 1, withOpening ? 3 : 2)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              code: '100123',
              materializedPath: '100000.100123',
            }),
          }),
        ])
      );
    }
  );

  it('suppresses post-commit effects if the journal fails after account persistence', async () => {
    const failure = new Error('journal insert failed');
    mockJournalEntryPersistenceService.create.mockRejectedValueOnce(failure);
    await expect(getUseCase()(validPayload)).rejects.toBe(failure);
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('suppresses events if standalone account persistence fails', async () => {
    const failure = new Error('account insert failed');
    mockLedgerAccountPersistenceService.createAndAssignCode.mockRejectedValueOnce(
      failure
    );
    await expect(
      getUseCase()({ ...validPayload, openingBalance: null })
    ).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
