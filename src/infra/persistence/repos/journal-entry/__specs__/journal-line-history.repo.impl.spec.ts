import { TEntityId } from '@shared/types/uuid';

import { journalLineHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import journalLineHistoryRepo from '@infra/persistence/repos/journal-entry/journal-line-history.repo.impl';
import journalLineHistoryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-line-history.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/journal-line-history.mapper');

describe('journalLineHistoryRepo', () => {
  const lineId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const options = { correlationId: 'correlation-id' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(journalLineHistoryMapper.toRepo).mockReturnValue({
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      onBehalfOf: null,
      id: lineId,
    } as never);
  });

  it('rejects a line without matching history', async () => {
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue({ insert: jest.fn() } as never);

    await expect(
      journalLineHistoryRepo.create(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: lineId,
        } as never,
        {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: '123e4567-e89b-12d3-a456-426614174002',
        } as never,
        lineId,
        options
      )
    ).rejects.toBeInstanceOf(Error);
  });

  it('creates history for single and multiple lines', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(getDbQueryHelper).mockReturnValue({ insert } as never);

    await journalLineHistoryRepo.create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: lineId,
      } as never,
      {
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        onBehalfOf: null,
        entityId: lineId,
      } as never,
      lineId,
      options
    );
    await journalLineHistoryRepo.create(
      [{ id: lineId }] as never,
      [{ entityId: lineId }] as never,
      lineId,
      options
    );

    expect(values).toHaveBeenCalledTimes(2);
  });

  it('deletes all line history for a journal entry', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const deleteQuery = jest.fn().mockReturnValue({ where });
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue({ delete: deleteQuery } as never);

    await journalLineHistoryRepo.deleteByJournalEntryId(lineId, options);

    expect(deleteQuery).toHaveBeenCalledWith(journalLineHistoryInAudit);
    expect(where).toHaveBeenCalledWith(expect.anything());
  });
});
