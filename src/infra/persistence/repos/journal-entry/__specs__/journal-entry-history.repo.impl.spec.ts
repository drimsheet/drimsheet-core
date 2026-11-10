import { TEntityId } from '@shared/types/uuid';

import { journalEntryHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import journalEntryHistoryRepo from '@infra/persistence/repos/journal-entry/journal-entry-history.repo.impl';
import journalEntryHistoryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-history.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/journal-entry-history.mapper');

describe('journalEntryHistoryRepo', () => {
  const entryId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const options = { correlationId: 'correlation-id' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(journalEntryHistoryMapper.toRepo).mockReturnValue({
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      onBehalfOf: null,
      id: entryId,
    } as never);
  });

  it('creates history for single and multiple entries', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(getDbQueryHelper).mockReturnValue({ insert } as never);

    await journalEntryHistoryRepo.create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: entryId,
      } as never,
      {
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        onBehalfOf: null,
        entityId: entryId,
      } as never,
      options
    );
    await journalEntryHistoryRepo.create(
      [{ id: entryId }] as never,
      [{ entityId: entryId }] as never,
      options
    );

    expect(insert).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledTimes(2);
  });

  it('deletes all history for a journal entry', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const deleteQuery = jest.fn().mockReturnValue({ where });
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue({ delete: deleteQuery } as never);

    await journalEntryHistoryRepo.deleteByJournalEntryId(entryId, options);

    expect(deleteQuery).toHaveBeenCalledWith(journalEntryHistoryInAudit);
    expect(where).toHaveBeenCalledWith(expect.anything());
  });
});
