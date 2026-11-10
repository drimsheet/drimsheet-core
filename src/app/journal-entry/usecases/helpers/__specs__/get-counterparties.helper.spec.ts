import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import getCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-counterparties.helper';

describe('getCounterpartiesHelper', () => {
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const [first] = counterpartyEntity.make({
    accountingEntityId,
    createdBy,
    name: 'Supplier',
    type: 'organization',
  });
  const [second] = counterpartyEntity.make({
    accountingEntityId,
    createdBy,
    name: 'Customer',
    type: 'individual',
  });
  const missingId = generateUUID();
  const repoOptions = { correlationId: 'counterparty-lookup' };

  function makePayload(ids: (string | null)[]) {
    return {
      ids,
      accountingEntityId,
      repo: mockCounterpartyRepo,
      repoOptions,
    };
  }

  beforeEach(() => jest.resetAllMocks());

  it('reads distinct non-null IDs once and returns the repository result unchanged', async () => {
    const ids = [second.id, null, first.id, second.id];
    const records = [first, second];
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce(records);

    const result = await getCounterpartiesHelper(makePayload(ids));

    expect(result).toBe(records);
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledTimes(1);
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [second.id, first.id],
      accountingEntityId,
      repoOptions
    );
    expect(ids).toEqual([second.id, null, first.id, second.id]);
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
  });

  it.each([{ ids: [] }, { ids: [null, null] }])(
    'passes an empty batch to the repository for $ids',
    async ({ ids }) => {
      const records: (typeof first)[] = [];
      mockCounterpartyRepo.findByIds.mockResolvedValueOnce(records);

      await expect(getCounterpartiesHelper(makePayload(ids))).resolves.toBe(
        records
      );
      expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
        [],
        accountingEntityId,
        repoOptions
      );
    }
  );

  it.each([
    { ids: [missingId], records: [] },
    { ids: [first.id, missingId, first.id], records: [first] },
  ])('rejects incomplete results for $ids', async ({ ids, records }) => {
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce(records);

    await expect(
      getCounterpartiesHelper(makePayload(ids))
    ).rejects.toMatchObject({
      errorKey: new counterpartyError.InvalidCounterpartyId().errorKey,
      cause: { id: missingId },
    });
  });

  it('preserves exact ID spelling and treats different spellings as distinct', async () => {
    const uppercaseId = 'A1111111-1111-4111-8111-111111111111';
    const lowercaseId = 'a1111111-1111-4111-8111-111111111111';
    const records = [
      { ...first, id: uppercaseId as TEntityId },
      { ...second, id: lowercaseId as TEntityId },
    ];
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce(records);

    await expect(
      getCounterpartiesHelper(
        makePayload([uppercaseId, lowercaseId, uppercaseId])
      )
    ).resolves.toBe(records);
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [uppercaseId, lowercaseId],
      accountingEntityId,
      repoOptions
    );
  });

  it('rejects a differently spelled returned ID without normalizing the requested ID', async () => {
    const requestedId = 'A1111111-1111-4111-8111-111111111111';
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([
      { ...first, id: 'a1111111-1111-4111-8111-111111111111' as TEntityId },
    ]);

    await expect(
      getCounterpartiesHelper(makePayload([requestedId]))
    ).rejects.toMatchObject({
      errorKey: new counterpartyError.InvalidCounterpartyId().errorKey,
      cause: { id: requestedId },
    });
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [requestedId],
      accountingEntityId,
      repoOptions
    );
  });

  it('propagates repository read failures', async () => {
    const failure = new Error('Counterparty read failed');
    mockCounterpartyRepo.findByIds.mockRejectedValueOnce(failure);

    await expect(getCounterpartiesHelper(makePayload([first.id]))).rejects.toBe(
      failure
    );
  });
});
