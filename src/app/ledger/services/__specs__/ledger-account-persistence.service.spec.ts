import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import {
  ITransactionContext,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import userEntity from '@domain/user/entities/user.entity';

import mockLedgerCodeAssignmentAppService from '@app/ledger/contracts/__mocks__/ledger-code-assignment.service.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';

describe('ledgerAccountPersistenceService', () => {
  const service = makeLedgerAccountPersistenceService({
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    repoService: mockRepoService,
    ledgerCodeAssignmentAppService: mockLedgerCodeAssignmentAppService,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  let repoOptions: IWriteRepoOptions<ILedgerAccountHistory[]>;
  let account: ILedgerAccount;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );

    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'owner@example.com',
      emailVerified: true,
      firstName: 'Account',
      lastName: 'Owner',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Owner Business',
      ownerId: user.id,
      type: EAccountingEntityType.Individual,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    [account] = await cashAccountService.createHeader(
      {
        name: 'Cash',
        accountingEntity,
        createdBy: user.actorId,
      },
      { correlationId: 'test-correlation-id' }
    );

    repoOptions = {
      correlationId: 'test-correlation-id',
      history: [
        {
          entityId: account.id,
          action: 'created',
          actorId: user.id,
          onBehalfOf: null,
          occurredAt: new Date(),
          correlationId: 'test-correlation-id',
          diff: { before: null, after: account },
        } as unknown as ILedgerAccountHistory,
      ],
    };
  });

  describe('create', () => {
    it('should successfully create account and balance within a transaction', async () => {
      await service.create(account, SYSTEM_CURRENCIES.NGN.code, repoOptions);

      expect(mockRepoService.runInTransaction).toHaveBeenCalled();

      expect(mockLedgerAccountRepo.create).toHaveBeenCalledWith(account, {
        ...repoOptions,
        tx: 'mock-tx',
      });

      expect(mockLedgerAccountBalanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerAccountId: account.id,
          accountingEntityId: account.accountingEntityId,
          accountMaterializedPath: account.materializedPath,
          amount: expect.objectContaining({
            currency: expect.objectContaining({
              code: SYSTEM_CURRENCIES.NGN.code,
            }),
          }),
          functionalAmount: expect.objectContaining({
            currency: expect.objectContaining({
              code: SYSTEM_CURRENCIES.NGN.code,
            }),
          }),
        }),
        {
          ...repoOptions,
          tx: 'mock-tx',
        }
      );
    });

    it('creates a null-currency account balance in functional currency', async () => {
      const nullCurrencyAccount: ILedgerAccount = {
        ...account,
        currency: null,
      };

      await service.create(
        nullCurrencyAccount,
        SYSTEM_CURRENCIES.NGN.code,
        repoOptions
      );

      expect(mockLedgerAccountBalanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.objectContaining({
            currency: SYSTEM_CURRENCIES.NGN,
          }),
          functionalAmount: expect.objectContaining({
            currency: SYSTEM_CURRENCIES.NGN,
          }),
        }),
        expect.objectContaining({ tx: 'mock-tx' })
      );
    });
  });
});

describe('ledgerAccountPersistenceService.createWithAssignedCode', () => {
  const service = makeLedgerAccountPersistenceService({
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    repoService: mockRepoService,
    ledgerCodeAssignmentAppService: mockLedgerCodeAssignmentAppService,
  });
  const tx: ITransactionContext = {};
  const correlationId = 'assignment-persistence';
  let auditedAccount: TAuditedLedgerAccount;
  const payload = () => ({
    account: auditedAccount[0],
    actorId: auditedAccount[0].createdBy,
    allocationHeaderCode: '100000',
  });

  const repoOptions = () => ({
    correlationId,
    history: [
      historyValue.make(auditedAccount[2], payload().actorId, correlationId),
    ],
  });

  beforeEach(() => {
    jest.resetAllMocks();
    auditedAccount = ledgerAccountEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      name: 'Petty cash',
      code: '100001',
      materializedPath: '100000.100001',
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      behavior: 'petty_cash',
      normalBalance: 'debit',
      isControlAccount: false,
      controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
      currency: SYSTEM_CURRENCIES.NGN,
      status: 'active',
      contraAccountRule: 'contra_permitted',
      adjunctAccountRule: 'adjunct_permitted',
      meta: null,
    });
    mockRepoService.runInTransaction.mockImplementation(async (fn, supplied) =>
      fn(supplied ?? tx)
    );
    mockLedgerCodeAssignmentAppService.assign.mockResolvedValue(
      ledgerAccountEntity.updateCode(auditedAccount[0], '100019')
    );
  });

  it.each([false, true])(
    'persists assigned values in the reused/local transaction (supplied: %s)',
    async (supplied) => {
      const options = supplied ? { ...repoOptions(), tx } : repoOptions();
      const assigned = await service.createWithAssignedCode(
        payload(),
        'NGN',
        options
      );
      expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        supplied ? tx : undefined
      );
      expect(mockLedgerCodeAssignmentAppService.assign).toHaveBeenCalledWith(
        { account: payload().account, allocationHeaderCode: '100000' },
        { ...repoOptions(), tx }
      );
      expect(mockLedgerAccountRepo.create).toHaveBeenCalledWith(
        assigned.account,
        { correlationId, tx, history: expect.any(Array) }
      );
      expect(mockLedgerAccountBalanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerAccountId: assigned.account.id,
          accountMaterializedPath: '100000.100019',
        }),
        { ...repoOptions(), tx }
      );
      expect(
        mockLedgerCodeAssignmentAppService.assign.mock.invocationCallOrder[0]
      ).toBeLessThan(mockLedgerAccountRepo.create.mock.invocationCallOrder[0]);
      expect(
        mockLedgerAccountRepo.create.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountBalanceRepo.create.mock.invocationCallOrder[0]
      );
      expect(assigned.account.code).toBe('100019');
      expect(assigned.events).toHaveLength(1);
      expect(assigned.events[0].data).toEqual(assigned.account);
      const storedHistory =
        mockLedgerAccountRepo.create.mock.calls[0][1].history;
      expect(storedHistory).toHaveLength(2);
      if (!Array.isArray(storedHistory))
        throw new Error('Expected history array');
      expect(storedHistory[0]).toEqual(repoOptions().history[0]);
      expect(storedHistory[1]).toMatchObject({
        actorId: payload().actorId,
        correlationId,
        diff: { before: { code: '100001' }, after: { code: '100019' } },
      });
    }
  );

  it('uses functional currency for an assigned null-currency control account', async () => {
    const assignment = await mockLedgerCodeAssignmentAppService.assign(
      payload(),
      { ...repoOptions(), tx }
    );
    mockLedgerCodeAssignmentAppService.assign.mockResolvedValueOnce([
      { ...assignment[0], currency: null },
      assignment[1],
      assignment[2],
    ]);
    await service.createWithAssignedCode(payload(), 'NGN', repoOptions());
    expect(mockLedgerAccountBalanceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expect.objectContaining({ currency: SYSTEM_CURRENCIES.NGN }),
      }),
      { ...repoOptions(), tx }
    );
  });

  it('does not insert when assignment fails', async () => {
    const failure = new Error('assignment failed');
    mockLedgerCodeAssignmentAppService.assign.mockRejectedValueOnce(failure);
    await expect(
      service.createWithAssignedCode(payload(), 'NGN', repoOptions())
    ).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.create).not.toHaveBeenCalled();
  });

  it('propagates account and balance failures to the transaction owner', async () => {
    const failure = new Error('insert failed');
    mockLedgerAccountRepo.create.mockRejectedValueOnce(failure);
    await expect(
      service.createWithAssignedCode(payload(), 'NGN', repoOptions())
    ).rejects.toBe(failure);
    expect(mockLedgerAccountBalanceRepo.create).not.toHaveBeenCalled();
    mockLedgerAccountBalanceRepo.create.mockRejectedValueOnce(failure);
    await expect(
      service.createWithAssignedCode(payload(), 'NGN', repoOptions())
    ).rejects.toBe(failure);
  });
});
