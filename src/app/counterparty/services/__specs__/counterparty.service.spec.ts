import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import {
  ECounterpartyStatus,
  ECounterpartyType,
  ICounterparty,
} from '@domain/counterparty/types/counterparty.types';

import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeCounterpartyAppService from '@app/counterparty/services/counterparty.service';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

const domainService = makeCounterpartyService({
  journalLineRepo: mockJournalLineRepo,
});

describe('makeCounterpartyAppService', () => {
  const service = makeCounterpartyAppService({
    counterpartyRepo: mockCounterpartyRepo,
    counterpartyService: domainService,
  });

  const accountingEntityId = generateUUID();
  const repoOptions = {
    correlationId: 'test-correlation-id',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreate', () => {
    it.each(['individual', 'organization'] as const)(
      'prepares a draft %s without metadata or writes',
      async (type) => {
        const result = await service.findOrCreate(
          { name: 'Draft supplier', type },
          accountingEntityId,
          generateUUID(),
          ECounterpartyStatus.Draft,
          repoOptions
        );
        expect(result.data[0]).toMatchObject({
          name: 'Draft supplier',
          type,
          status: 'draft',
          roles: [],
          meta: {},
        });
        expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      }
    );

    it('rejects missing type for draft creation', async () => {
      await expect(
        service.findOrCreate(
          { name: 'Draft supplier' },
          accountingEntityId,
          generateUUID(),
          ECounterpartyStatus.Draft,
          repoOptions
        )
      ).rejects.toThrow(counterpartyError.InvalidType);
    });

    it('preserves the stored draft status when selected by ID for an active creation context', async () => {
      const [draft] = domainService.create({
        name: 'Draft supplier',
        type: 'individual',
        status: 'draft',
        accountingEntityId,
        createdBy: generateUUID(),
      });
      mockCounterpartyRepo.findById.mockResolvedValueOnce(draft);
      const result = await service.findOrCreate(
        { id: draft.id, name: draft.name },
        accountingEntityId,
        generateUUID(),
        ECounterpartyStatus.Active,
        repoOptions
      );
      expect(result.new).toBe(false);
      expect(result.data[0]).toBe(draft);
    });

    describe('when payload contains id', () => {
      it('should return existing counterparty if found', async () => {
        const id = generateUUID();
        const mockCounterparty: ICounterparty = {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id,
          accountingEntityId,
          name: 'Jane Doe',
          type: ECounterpartyType.Individual,
          meta: {},
          roles: [],
          status: 'active',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockCounterpartyRepo.findById.mockResolvedValueOnce(mockCounterparty);

        const result = await service.findOrCreate(
          { id, name: 'Jane Doe' },
          accountingEntityId,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          ECounterpartyStatus.Active,
          repoOptions
        );

        expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
          id,
          accountingEntityId,
          repoOptions
        );
        expect(result).toEqual({
          new: false,
          data: [mockCounterparty, [], {}],
        });
      });

      it('should throw InvalidCounterpartyId if not found', async () => {
        const id = generateUUID();
        mockCounterpartyRepo.findById.mockResolvedValueOnce(null);

        await expect(
          service.findOrCreate(
            { id, name: 'Jane Doe' },
            accountingEntityId,
            'a1111111-1111-4111-8111-111111111111' as TEntityId,
            ECounterpartyStatus.Active,
            repoOptions
          )
        ).rejects.toThrow(counterpartyError.InvalidCounterpartyId);

        expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
          id,
          accountingEntityId,
          repoOptions
        );
      });
    });

    describe('when payload does not contain id', () => {
      it('should create and return a new counterparty with specified type', async () => {
        const result = await service.findOrCreate(
          { name: 'John Smith', type: ECounterpartyType.Organization },
          accountingEntityId,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          ECounterpartyStatus.Active,
          repoOptions
        );

        expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
        expect(result.new).toBe(true);
        expect(result.data[0].name).toBe('John Smith');
        expect(result.data[0].type).toBe(ECounterpartyType.Organization);
        expect(result.data[1]).toHaveLength(1); // 'domain:counterparty:created' event
      });

      it('should default type to Individual if not specified', async () => {
        const result = await service.findOrCreate(
          { name: 'John Smith' },
          accountingEntityId,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          ECounterpartyStatus.Active,
          repoOptions
        );

        expect(result.new).toBe(true);
        expect(result.data[0].name).toBe('John Smith');
        expect(result.data[0].type).toBe(ECounterpartyType.Individual);
      });
    });
  });

  describe('findOrCreateMany', () => {
    it('accepts and deduplicates existing draft IDs without requiring their type again', async () => {
      const [draft] = domainService.create({
        name: 'Draft supplier',
        type: 'organization',
        status: 'draft',
        accountingEntityId,
        createdBy: generateUUID(),
      });
      mockCounterpartyRepo.findById.mockResolvedValueOnce(draft);
      const input = { id: draft.id, name: draft.name };
      const result = await service.findOrCreateMany(
        [input, input],
        accountingEntityId,
        generateUUID(),
        ECounterpartyStatus.Draft,
        repoOptions
      );
      expect(result.size).toBe(1);
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledTimes(1);
      expect(service.getFoundOrCreated(input, result)?.data[0]).toBe(draft);
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    });

    it('deduplicates explicit draft inputs and retains organization type', async () => {
      const input = { name: 'Supplier', type: ECounterpartyType.Organization };
      const result = await service.findOrCreateMany(
        [input, { ...input, name: ' Supplier ' }],
        accountingEntityId,
        generateUUID(),
        ECounterpartyStatus.Draft,
        repoOptions
      );
      expect(result.size).toBe(1);
      expect(service.getFoundOrCreated(input, result)?.data[0]).toMatchObject({
        status: 'draft',
        type: 'organization',
      });
    });

    it('rejects a missing draft type even when a prior explicit individual has the same key', async () => {
      await expect(
        service.findOrCreateMany(
          [{ name: 'Supplier', type: 'individual' }, { name: 'Supplier' }],
          accountingEntityId,
          generateUUID(),
          ECounterpartyStatus.Draft,
          repoOptions
        )
      ).rejects.toThrow(counterpartyError.InvalidType);
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    });

    it('should deduplicate names using their normalized form', async () => {
      const result = await service.findOrCreateMany(
        [{ name: 'Jane Doe' }, { name: '  Jane Doe  ' }],
        accountingEntityId,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ECounterpartyStatus.Active,
        repoOptions
      );

      expect(result.size).toBe(1);

      const counterparty = service.getFoundOrCreated(
        { name: ' Jane Doe ' },
        result
      );

      expect(counterparty?.new).toBe(true);
      expect(counterparty?.data[0].name).toBe('Jane Doe');
    });
  });
});
