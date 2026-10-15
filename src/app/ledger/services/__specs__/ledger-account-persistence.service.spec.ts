import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import {
  ITransactionContext,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import userEntity from '@domain/user/entities/user.entity';

import { mockLedgerAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeLedgerAccountPersistenceAppService from '@app/ledger/services/ledger-account-persistence.service';

describe('ledgerAccountPersistenceAppService', () => {
  const service = makeLedgerAccountPersistenceAppService({
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    repoService: mockRepoService,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
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
    it('propagates a database currency rejection through the atomic account/balance write', async () => {
      const error = new accountingEntityError.FunctionalCurrencyMismatch();
      mockLedgerAccountBalanceRepo.create.mockRejectedValueOnce(error);
      await expect(service.create(account, 'NGN', repoOptions)).rejects.toBe(
        error
      );
      expect(mockLedgerAccountBalanceRepo.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tx: 'mock-tx' })
      );
    });

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
  it.each([
    undefined,
    'posting',
    'control',
    'postingBalance',
    'controlBalance',
  ] as const)(
    'persists prepared promotion with ordinary writes, failure=%s',
    async (failureAt) => {
      const [original] = ledgerAccountEntity.make({
        ...account,
        isControlAccount: false,
        code: '100001',
        materializedPath: '100000.100001',
        controlAccountId: account.id,
      });
      const controlAccount =
        ledgerAccountEntity.clonePostingAccountToControlAccount(
          original,
          account.createdBy
        );
      const [control, , controlAudit] = controlAccount;
      const postingAccount = ledgerAccountEntity.reparentPostingAccount(
        original,
        control,
        '100002'
      );
      const [posting, , postingAudit] = postingAccount;
      const existingBalance = ledgerAccountBalanceEntity.make({
        createdBy: account.createdBy,
        ledgerAccountId: original.id,
        accountingEntityId: original.accountingEntityId,
        accountMaterializedPath: original.materializedPath,
        currencyCode: 'NGN',
        functionalCurrencyCode: 'NGN',
        amount: 12345n,
        functionalAmount: 12345n,
      });
      const sourceAdjustment = ledgerAccountBalanceEntity.adjust(
        existingBalance,
        {
          createdBy: original.createdBy,
          ledgerAccountId: original.id,
          journalEntryId: generateUUID(),
          amount: existingBalance.amount,
          functionalAmount: existingBalance.functionalAmount,
        }
      ).adjustment;
      const promotion = {
        controlAdjustments: [
          ledgerAccountBalanceEntity.cloneAdjustmentToControlAccount(
            sourceAdjustment,
            control.id
          ),
        ],
        controlAccount,
        postingAccount,
        postingBalance: ledgerAccountBalanceEntity.updateAccountCode(
          existingBalance,
          posting.materializedPath
        ),
        controlBalance: ledgerAccountBalanceEntity.cloneToControlAccount(
          existingBalance,
          control.id,
          control.createdBy
        ),
      };
      const options = {
        ...repoOptions,
        tx: {},
        history: [
          historyValue.make(controlAudit, account.createdBy, 'promotion'),
          historyValue.make(postingAudit, account.createdBy, 'promotion'),
        ],
      };
      const writes = {
        posting: mockLedgerAccountRepo.update,
        control: mockLedgerAccountRepo.create,
        postingBalance: mockLedgerAccountBalanceRepo.update,
        controlBalance: mockLedgerAccountBalanceRepo.createWithAdjustments,
      };
      if (failureAt) {
        const failure = new Error(`${failureAt} write failed`);
        writes[failureAt].mockRejectedValueOnce(failure);
        await expect(service.promote(promotion, options)).rejects.toBe(failure);
        const failedIndex = Object.keys(writes).indexOf(failureAt);
        Object.values(writes).forEach((write, index) => {
          expect(write).toHaveBeenCalledTimes(index <= failedIndex ? 1 : 0);
        });
        return;
      }
      await service.promote(promotion, options);
      expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        options.tx
      );
      expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(posting, {
        ...options,
        tx: 'mock-tx',
        expectedVersion: original.version,
        history: options.history[1],
      });
      expect(mockLedgerAccountRepo.create).toHaveBeenCalledWith(control, {
        ...options,
        tx: 'mock-tx',
        history: [options.history[0]],
      });
      expect(
        mockLedgerAccountRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(mockLedgerAccountRepo.create.mock.invocationCallOrder[0]);
      expect(
        mockLedgerAccountRepo.create.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountBalanceRepo.update.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountBalanceRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountBalanceRepo.createWithAdjustments.mock
          .invocationCallOrder[0]
      );
      expect(mockLedgerAccountBalanceRepo.update).toHaveBeenCalledWith(
        promotion.postingBalance,
        {
          correlationId: options.correlationId,
          tx: 'mock-tx',
          expectedVersion: existingBalance.version,
        }
      );
      expect(
        mockLedgerAccountBalanceRepo.createWithAdjustments
      ).toHaveBeenCalledWith(
        {
          balance: promotion.controlBalance,
          adjustments: promotion.controlAdjustments,
        },
        { ...options, tx: 'mock-tx' }
      );
      expect(promotion.controlBalance.amount.amount).toBe(12345n);
      expect(promotion.postingBalance.amount.amount).toBe(12345n);
      expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    }
  );
});
