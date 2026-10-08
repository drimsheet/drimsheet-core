import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeGetCounterpartyDeletionEligibilityUsecase from '@app/counterparty/usecases/get-counterparty-deletion-eligibility.usecase';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';

describe('get counterparty deletion eligibility use case', () => {
  const actorId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'eligibility';
  const [counterparty] = counterpartyEntity.make({
    createdBy: actorId,
    accountingEntityId,
    name: 'Deletion candidate',
    type: 'individual',
    status: 'active',
  });
  const usecase = makeGetCounterpartyDeletionEligibilityUsecase({
    appContext: mockAppContext,
    counterpartyRepo: mockCounterpartyRepo,
    journalEntryQueryRepo: mockJournalEntryQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: accountingEntityId },
      correlationId,
    } as IAppContextData);
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
  });

  it('rejects an invalid ID before reading context or repositories', async () => {
    await expect(usecase('invalid')).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    expect(
      mockJournalEntryQueryRepo.existsByCounterpartyId
    ).not.toHaveBeenCalled();
  });

  it.each([
    { hasTransactionReferences: false, canDelete: true },
    { hasTransactionReferences: true, canDelete: false },
  ])(
    'returns canDelete=$canDelete when reference existence is $hasTransactionReferences',
    async ({ hasTransactionReferences, canDelete }) => {
      mockJournalEntryQueryRepo.existsByCounterpartyId.mockResolvedValue(
        hasTransactionReferences
      );

      await expect(usecase(counterparty.id)).resolves.toEqual({ canDelete });
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
        counterparty.id,
        accountingEntityId,
        { correlationId }
      );
      expect(
        mockJournalEntryQueryRepo.existsByCounterpartyId
      ).toHaveBeenCalledWith(counterparty.id, accountingEntityId, {
        correlationId,
      });
    }
  );

  it('hides an absent counterparty without checking references', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(null);

    await expect(usecase(counterparty.id)).rejects.toThrow(
      appError.ResourceNotFound
    );
    expect(
      mockJournalEntryQueryRepo.existsByCounterpartyId
    ).not.toHaveBeenCalled();
  });

  it.each(['counterparty', 'reference'] as const)(
    'propagates %s query failures',
    async (stage) => {
      const failure = new Error(`${stage} query failed`);
      if (stage === 'counterparty') {
        mockCounterpartyRepo.findById.mockRejectedValue(failure);
      } else {
        mockJournalEntryQueryRepo.existsByCounterpartyId.mockRejectedValue(
          failure
        );
      }

      await expect(usecase(counterparty.id)).rejects.toBe(failure);
    }
  );
});
