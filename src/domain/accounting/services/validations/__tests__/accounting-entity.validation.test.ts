import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import accountingEntityServiceValidation from '@domain/accounting/services/validations/accounting-entity.validation';
import { IAccountingEntityCreationInput } from '@domain/accounting/types/accounting-entity.service.types';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

const repo: jest.Mocked<IAccountingEntityRepo> = {
  delete: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findByUserId: jest.fn(),
};

describe('accountingEntityServiceValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(accountingEntityServiceValidation)).toBe(true);
  });

  const ownerId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const repoOptions: IReadRepoOptions = { correlationId: 'correlation-id' };
  const input: IAccountingEntityCreationInput = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Business',
    type: EAccountingEntityType.Individual,
    ownerId,
    functionalCurrencyCode: 'USD',
    jurisdictionCode: 'US',
  };

  describe('validateExistingIndividualEntity', () => {
    it('does not query existing entities for a non-individual entity', async () => {
      await expect(
        accountingEntityServiceValidation.validateExistingIndividualEntity(
          repo,
          { ...input, type: EAccountingEntityType.SoleTrader },
          repoOptions
        )
      ).resolves.toBeUndefined();

      expect(repo.findByUserId).not.toHaveBeenCalled();
    });

    it('allows an individual entity when the owner has none', async () => {
      repo.findByUserId.mockResolvedValue([]);

      await expect(
        accountingEntityServiceValidation.validateExistingIndividualEntity(
          repo,
          input,
          repoOptions
        )
      ).resolves.toBeUndefined();

      expect(repo.findByUserId).toHaveBeenCalledWith(
        ownerId,
        repoOptions,
        EAccountingEntityType.Individual
      );
    });

    it('rejects an individual entity when the owner already has one', async () => {
      repo.findByUserId.mockResolvedValue([
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        } as IAccountingEntity,
      ]);

      await expect(
        accountingEntityServiceValidation.validateExistingIndividualEntity(
          repo,
          input,
          repoOptions
        )
      ).rejects.toThrow(
        accountingEntityError.OnlyOneIndividualAccountingEntityAllowed
      );
    });
  });
});

describe('accountingEntityServiceValidation.validateDeletionAllowed', () => {
  const journalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
    existsByAccountingEntityId: jest.fn(),
    existsByAccountId: jest.fn(),
    existsPostedByAccountId: jest.fn(),
    findAllByAccountIds: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
  };
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const options = { correlationId: 'delete', tx: {} };
  beforeEach(() => jest.resetAllMocks());

  it('allows deletion only when the unfiltered journal check finds no references', async () => {
    journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(false);
    await expect(
      accountingEntityServiceValidation.validateDeletionAllowed(
        journalEntryRepo,
        id,
        options
      )
    ).resolves.toBeUndefined();
    expect(journalEntryRepo.existsByAccountingEntityId).toHaveBeenCalledWith(
      id,
      options
    );
  });

  it('rejects journal references using the accounting entity conflict error', async () => {
    journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(true);
    await expect(
      accountingEntityServiceValidation.validateDeletionAllowed(
        journalEntryRepo,
        id,
        options
      )
    ).rejects.toBeInstanceOf(accountingEntityError.DeletionWithJournalEntries);
  });

  it('propagates a failed check instead of permitting deletion', async () => {
    const failure = new Error('read failed');
    journalEntryRepo.existsByAccountingEntityId.mockRejectedValue(failure);
    await expect(
      accountingEntityServiceValidation.validateDeletionAllowed(
        journalEntryRepo,
        id,
        options
      )
    ).rejects.toBe(failure);
  });
});
