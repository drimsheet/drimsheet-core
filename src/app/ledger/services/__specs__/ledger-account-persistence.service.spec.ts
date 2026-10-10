import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import {
  ITransactionContext,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import userEntity from '@domain/user/entities/user.entity';

import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
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
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
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
