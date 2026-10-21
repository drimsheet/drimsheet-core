import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import runtimeError from '@shared/values/errors/runtime.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import currencyEntity from '@domain/money/entities/currency.entity';

import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeUpdateAccountingEntityUsecase from '@app/accounting/usecases/update-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountBalanceRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const [current] = accountingEntityEntity.make({
  createdBy: actorId,
  ownerId: actorId,
  name: 'Business',
  type: 'sole_trader',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const balance = ledgerAccountBalanceEntity.make({
  createdBy: actorId,
  accountingEntityId: current.id,
  ledgerAccountId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
  accountMaterializedPath: '100000',
  currencyCode: 'GBP',
  functionalCurrencyCode: 'NGN',
});
const preparedBalance = ledgerAccountBalanceEntity.changeFunctionalCurrency(
  ledgerAccountBalanceEntity.updateAccountCode(balance, '101000'),
  currencyEntity.getByCode('USD')
);
const usecase = makeUpdateAccountingEntityUsecase({
  appContext: mockAppContext,
  accountingEntityRepo: mockAccountingEntityRepo,
  accountingEntityService: mockAccountingEntityService,
  ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});
const options = { correlationId: 'update', tx: mockRepoTransaction.context };

describe('updateAccountingEntityUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: current,
      correlationId: 'update',
    } as ReturnType<typeof mockAppContext.get>);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockAccountingEntityRepo.findById.mockResolvedValue(current);
    mockAccountingEntityService.update.mockImplementation(
      async (entity, changes) => ({
        accountingEntity: accountingEntityEntity.update(entity, changes),
        updatedBalances: [],
      })
    );
  });

  it('locks fresh state and atomically saves exactly the prepared entity, audit and balances', async () => {
    mockAccountingEntityService.update.mockResolvedValue({
      accountingEntity: accountingEntityEntity.update(current, {
        name: 'Updated',
        type: 'private_company',
        functionalCurrencyCode: 'USD',
      }),
      updatedBalances: [preparedBalance],
    });
    const result = await usecase({
      name: 'Updated',
      entityType: 'private_company',
      functionalCurrencyCode: 'USD',
    });
    expect(mockAccountingEntityRepo.findById).toHaveBeenCalledWith(current.id, {
      ...options,
      lock: 'update',
    });
    expect(mockAccountingEntityService.update).toHaveBeenCalledWith(
      current,
      {
        name: 'Updated',
        type: 'private_company',
        functionalCurrencyCode: 'USD',
      },
      options
    );
    expect(mockAccountingEntityRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated' }),
      {
        ...options,
        history: expect.objectContaining({
          actorId,
          action: 'updated',
          correlationId: 'update',
        }),
      }
    );
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountingEntityId
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.update).toHaveBeenCalledWith(
      preparedBalance,
      { ...options, expectedVersion: preparedBalance.version - 1 }
    );
    expect(result).toMatchObject({
      id: current.id,
      name: 'Updated',
      type: 'private_company',
      functionalCurrencyCode: 'USD',
    });
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: expect.objectContaining(result),
    });
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
  });

  it('does not load or update balances when only the name changes', async () => {
    await usecase({ name: 'Updated' });
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountingEntityId
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.update).not.toHaveBeenCalled();
  });

  it('returns unchanged state without writes or events for a no-op', async () => {
    const response = await usecase({
      name: ' Business ',
      functionalCurrencyCode: 'NGN',
    });
    expect(response).toBe(current);
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountingEntityId
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('does not write balances when the domain returns none for a currency change', async () => {
    await usecase({ functionalCurrencyCode: 'USD' });
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountingEntityId
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.update).not.toHaveBeenCalled();
  });

  it('rejects absent entity context before opening a transaction', async () => {
    const failure = new runtimeError.ContextNotFound();
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(usecase({ name: 'New' })).rejects.toBe(failure);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'actor',
      'accountingEntity',
    ]);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing entities before domain mutation', async () => {
    mockAccountingEntityRepo.findById.mockResolvedValue(null);
    await expect(usecase({ name: 'New' })).rejects.toThrow(
      accountingAppError.ActiveEntityNotFound
    );
    expect(mockAccountingEntityService.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('does not persist when the domain service rejects the update', async () => {
    mockAccountingEntityService.update.mockRejectedValue(
      new accountingEntityError.FunctionalCurrencyChangeNotAllowed()
    );
    await expect(usecase({ functionalCurrencyCode: 'USD' })).rejects.toThrow(
      accountingEntityError.FunctionalCurrencyChangeNotAllowed
    );
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('rolls back on a balance write conflict without publishing or updating context', async () => {
    mockAccountingEntityService.update.mockResolvedValue({
      accountingEntity: accountingEntityEntity.update(current, {
        functionalCurrencyCode: 'USD',
      }),
      updatedBalances: [preparedBalance],
    });
    const failure = new Error('balance conflict');
    mockLedgerAccountBalanceRepo.update.mockRejectedValue(failure);
    await expect(usecase({ functionalCurrencyCode: 'USD' })).rejects.toBe(
      failure
    );
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish when commit fails', async () => {
    const failure = new Error('commit');
    mockRepoTransaction.commit.mockRejectedValue(failure);
    await expect(usecase({ name: 'New' })).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates post-commit publication failures through transaction lifecycle handling', async () => {
    const failure = new Error('publish');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(usecase({ name: 'New' })).rejects.toBe(failure);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
  });

  it.each([{}, { name: null }, { ownerId: actorId }])(
    'rejects invalid input %j before starting a transaction',
    async (payload) => {
      // @ts-expect-error runtime validation
      await expect(usecase(payload)).rejects.toThrow();
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );
});
