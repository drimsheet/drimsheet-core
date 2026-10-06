import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeDeleteCounterpartyUsecase from '@app/counterparty/usecases/delete-counterparty.usecase';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

const [counterparty] = counterpartyEntity.make({
  createdBy: generateUUID(),
  accountingEntityId: generateUUID(),
  name: 'Delete me',
  type: 'individual',
  status: 'active',
});
const usecase = makeDeleteCounterpartyUsecase({
  appContext: mockAppContext,
  repoService: mockRepoService,
  counterpartyRepo: mockCounterpartyRepo,
  journalLineRepo: mockJournalLineRepo,
});

describe('delete counterparty use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: counterparty.createdBy },
      accountingEntity: { id: counterparty.accountingEntityId },
      correlationId: 'delete',
    } as IAppContextData);
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
    mockJournalLineRepo.findAllByCounterpartyId.mockResolvedValue([]);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it.each(['draft', 'active', 'archived'] as const)(
    'deletes an eligible %s counterparty in the locked transaction',
    async (status) => {
      const [current] = counterpartyEntity.make({
        createdBy: counterparty.createdBy,
        accountingEntityId: counterparty.accountingEntityId,
        name: counterparty.name,
        type: counterparty.type,
        status,
      });
      mockCounterpartyRepo.findById.mockResolvedValue(current);
      await expect(usecase(current.id)).resolves.toBeUndefined();
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
        current.id,
        current.accountingEntityId,
        {
          correlationId: 'delete',
          tx: mockRepoTransaction.context,
          lock: 'update',
        }
      );
      expect(mockJournalLineRepo.findAllByCounterpartyId).toHaveBeenCalledWith(
        current.id,
        current.accountingEntityId,
        {
          correlationId: 'delete',
          tx: mockRepoTransaction.context,
        }
      );
      expect(mockCounterpartyRepo.delete).toHaveBeenCalledWith(
        current.id,
        current.accountingEntityId,
        {
          correlationId: 'delete',
          tx: mockRepoTransaction.context,
          expectedVersion: current.version,
        }
      );
      expect(
        mockJournalLineRepo.findAllByCounterpartyId.mock.invocationCallOrder[0]
      ).toBeGreaterThan(
        mockCounterpartyRepo.findById.mock.invocationCallOrder[0]
      );
      expect(
        mockCounterpartyRepo.delete.mock.invocationCallOrder[0]
      ).toBeGreaterThan(
        mockJournalLineRepo.findAllByCounterpartyId.mock.invocationCallOrder[0]
      );
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeGreaterThan(
        mockCounterpartyRepo.delete.mock.invocationCallOrder[0]
      );
      expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    }
  );

  it('rejects invalid IDs before context or transaction access', async () => {
    await expect(usecase('invalid')).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it.each([null, { ...counterparty, accountingEntityId: generateUUID() }])(
    'hides missing/foreign records %p',
    async (stored) => {
      mockCounterpartyRepo.findById.mockResolvedValue(stored);
      await expect(usecase(counterparty.id)).rejects.toThrow(
        appError.ResourceNotFound
      );
      expect(
        mockJournalLineRepo.findAllByCounterpartyId
      ).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    }
  );

  it('rejects remaining transaction references without deleting', async () => {
    const [line] = journalLineEntity.make(
      {
        id: generateUUID(),
        createdBy: counterparty.createdBy,
        memo: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        accountId: generateUUID(),
        counterpartyId: counterparty.id,
        sequenceOrder: 1,
        amount: moneyValue.make(1000, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        side: 'debit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      }
    );
    mockJournalLineRepo.findAllByCounterpartyId.mockResolvedValue([line]);
    await expect(usecase(counterparty.id)).rejects.toMatchObject({
      errorKey:
        'counterparty_error_deletion_with_transaction_references_conflict',
      cause: {
        reason: 'transaction_usage',
        nextAction: 'archive_counterparty',
      },
    });
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      expect.any(counterpartyError.DeletionWithTransactionReferences)
    );
    expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it.each(['context', 'acquire', 'read', 'usage', 'write', 'commit'] as const)(
    'preserves %s failures and disposes acquired transactions',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'context')
        mockAppContext.get.mockImplementation(() => {
          throw failure;
        });
      if (stage === 'acquire')
        mockRepoService.createTransaction.mockRejectedValue(failure);
      if (stage === 'read')
        mockCounterpartyRepo.findById.mockRejectedValue(failure);
      if (stage === 'usage')
        mockJournalLineRepo.findAllByCounterpartyId.mockRejectedValue(failure);
      if (stage === 'write')
        mockCounterpartyRepo.delete.mockRejectedValue(failure);
      if (stage === 'commit')
        mockRepoTransaction.commit.mockRejectedValue(failure);
      await expect(usecase(counterparty.id)).rejects.toBe(failure);
      if (['context', 'acquire'].includes(stage))
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      else
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      if (stage !== 'commit')
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      if (['context', 'acquire', 'read', 'usage'].includes(stage))
        expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
    }
  );

  it('propagates conditional delete conflicts', async () => {
    const failure = new repoError.VersionNotFound();
    mockCounterpartyRepo.delete.mockRejectedValue(failure);
    await expect(usecase(counterparty.id)).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('preserves cleanup failures', async () => {
    const operationError = new Error('delete failed');
    const cleanupError = new Error('rollback failed');
    const failure = new repoError.TransactionCleanupFailed({
      operationError,
      cleanupError,
    });
    mockCounterpartyRepo.delete.mockRejectedValue(operationError);
    mockRepoTransaction.handleError.mockRejectedValue(failure);
    await expect(usecase(counterparty.id)).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      operationError
    );
  });

  it.each(['commit', 'handleError'] as const)(
    'awaits %s before settling the request',
    async (stage) => {
      let release!: () => void;
      let started!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const failure = new Error('delete failed');
      if (stage === 'commit')
        mockRepoTransaction.commit.mockImplementation(async () => {
          started();
          await blocked;
        });
      else {
        mockCounterpartyRepo.delete.mockRejectedValue(failure);
        mockRepoTransaction.handleError.mockImplementation(async (error) => {
          started();
          await blocked;
          throw error;
        });
      }
      let settled = false;
      const request = usecase(counterparty.id).then(
        () => {
          settled = true;
        },
        (error: unknown) => {
          settled = true;
          return error;
        }
      );
      try {
        await ready;
        expect(settled).toBe(false);
      } finally {
        release();
        await request;
      }
      expect(settled).toBe(true);
      if (stage === 'handleError') expect(await request).toBe(failure);
    }
  );
});
