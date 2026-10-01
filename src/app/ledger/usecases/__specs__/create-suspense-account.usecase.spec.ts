import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock, ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeSuspenseAccountService from '@domain/ledger/services/suspense-account/suspense-account.service';
import currencyError from '@domain/money/errors/currency.error';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockPersistence from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import { mockSuspenseAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import makeCreateSuspenseAccountUsecase from '@app/ledger/usecases/create-suspense-account.usecase';

const actor = actorEntity.makeUser({
  email: 'suspense@example.com',
  displayName: 'Owner',
})[0];
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const tx: ITransactionContext = {};
const correlationId = 'suspense-spec';
const valid: ICreateSuspenseAccountDto = {
  name: 'Unclassified',
  type: 'asset',
  currencyCode: 'USD',
};
const usecase = makeCreateSuspenseAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  repoService: mockRepoService,
  accountingEntityRepo: mockAccountingEntityRepo,
  suspenseAccountService: mockSuspenseAccountService,
  ledgerAccountPersistenceService: mockPersistence,
});

describe('createSuspenseAccountUsecase', () => {
  let committed: boolean;
  let locked: boolean;
  beforeEach(() => {
    jest.resetAllMocks();
    committed = false;
    locked = false;
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockAccountingEntityRepo.findById.mockImplementation(async () => {
      locked = true;
      return accountingEntity;
    });
    mockLedgerAccountRepo.findBySubType.mockImplementation(
      async (_id, _type, _subType, options) => {
        expect(locked).toBe(true);
        expect(options.tx).toBe(tx);
        return [];
      }
    );
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
    const service = makeSuspenseAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockSuspenseAccountService.createAssetSuspense.mockImplementation(
      service.createAssetSuspense
    );
    mockSuspenseAccountService.createLiabilitySuspense.mockImplementation(
      service.createLiabilitySuspense
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

  it.each(['asset', 'liability'] as const)(
    'creates one %s with final code, audit and zero balances',
    async (type) => {
      const result = await usecase({ ...valid, type });
      const [account, currency, options] =
        mockPersistence.createWithoutAssigningCode.mock.calls[0];
      expect(mockAccountingEntityRepo.findById).toHaveBeenCalledWith(
        accountingEntity.id,
        { correlationId, tx, lock: ERepoLock.Update }
      );
      expect(account).toMatchObject({
        name: valid.name,
        type,
        subType: 'suspense',
        behavior: 'default',
        accountingEntityId: accountingEntity.id,
        createdBy: actor.id,
        code: type === 'asset' ? '199000' : '299000',
        isControlAccount: false,
        controlAccountId: null,
        currency: { code: 'USD' },
      });
      expect(account.materializedPath).toBe(account.code);
      expect(currency).toBe('NGN');
      expect(options).toMatchObject({
        correlationId,
        tx,
        history: [
          {
            actorId: actor.id,
            entityVersion: 1,
            diff: { before: null, after: JSON.parse(JSON.stringify(account)) },
          },
        ],
      });
      expect(result).toMatchObject({
        id: account.id,
        code: account.code,
        balance: { amount: 0, currencyCode: 'USD' },
        functionalBalance: { amount: 0, currencyCode: 'NGN' },
      });
      expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
        accountingEntity.id,
        type,
        'suspense',
        { correlationId, tx }
      );
      const selected =
        type === 'asset'
          ? mockSuspenseAccountService.createAssetSuspense
          : mockSuspenseAccountService.createLiabilitySuspense;
      const other =
        type === 'asset'
          ? mockSuspenseAccountService.createLiabilitySuspense
          : mockSuspenseAccountService.createAssetSuspense;
      expect(selected).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
      expect(mockPersistence.createAndAssignCode).not.toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish.mock.calls[0][0]).toEqual([
        expect.objectContaining({ correlationId, data: account }),
      ]);
    }
  );

  it('rejects transport errors before context or transactions', async () => {
    await expect(usecase({ ...valid, name: '' })).rejects.toBeInstanceOf(
      appError.UnprocessableEntity
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });
  it('rejects an unknown currency before taking a lock', async () => {
    await expect(
      usecase({ ...valid, currencyCode: 'ZZZ' })
    ).rejects.toBeInstanceOf(currencyError.InvalidCode);
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });
  it('rejects a missing accounting entity before domain reads or writes', async () => {
    mockAccountingEntityRepo.findById.mockResolvedValueOnce(null);
    await expect(usecase(valid)).rejects.toBeInstanceOf(
      accountingAppError.ActiveEntityNotFound
    );
    expect(
      mockSuspenseAccountService.createAssetSuspense
    ).not.toHaveBeenCalled();
    expect(mockPersistence.createWithoutAssigningCode).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('rejects a domain duplicate without persistence or publication', async () => {
    mockSuspenseAccountService.createAssetSuspense.mockRejectedValueOnce(
      new ledgerAccountError.SuspenseAccountAlreadyExists()
    );
    await expect(usecase(valid)).rejects.toBeInstanceOf(
      ledgerAccountError.SuspenseAccountAlreadyExists
    );
    expect(mockPersistence.createWithoutAssigningCode).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('propagates lock failures without domain creation', async () => {
    const failure = new Error('lock failed');
    mockAccountingEntityRepo.findById.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(
      mockSuspenseAccountService.createAssetSuspense
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('propagates persistence failures without publication', async () => {
    const failure = new Error('balance failed');
    mockPersistence.createWithoutAssigningCode.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(committed).toBe(false);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('does not publish on commit failure', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementationOnce(async (fn) => {
      await fn(tx);
      throw failure;
    });
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('does not retry creation after publication fails following commit', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(committed).toBe(true);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockPersistence.createWithoutAssigningCode).toHaveBeenCalledTimes(1);
  });
});
