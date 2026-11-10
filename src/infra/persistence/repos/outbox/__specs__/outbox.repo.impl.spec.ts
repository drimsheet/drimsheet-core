import { EOutboxType } from '@shared/types/outbox.types';
import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';

import { outboxInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import outboxMapper from '@infra/persistence/repos/outbox/mappers/outbox.mapper';
import outboxRepo from '@infra/persistence/repos/outbox/outbox.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/outbox.mapper');

describe('outboxRepo', () => {
  const tx = 'transaction' as unknown as ITransactionContext;
  const options = { correlationId: generateUUID(), tx };

  beforeEach(() => jest.clearAllMocks());

  it('creates the exact application-supplied row in the provided transaction', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ insert });
    const row = {
      id: generateUUID(),
      correlationId: options.correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: null,
    };
    const repositoryRow = { ...row };
    (outboxMapper.toRepo as jest.Mock).mockReturnValue(repositoryRow);

    await outboxRepo.create(row, options);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(insert).toHaveBeenCalledWith(outboxInCore);
    expect(outboxMapper.toRepo).toHaveBeenCalledWith(row);
    expect(values).toHaveBeenCalledWith(repositoryRow);
  });

  it('returns a row by application ID and type', async () => {
    const id = generateUUID();
    const databaseRow = {
      id,
      correlationId: options.correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: null,
      createdAt: '2026-08-18T12:00:00.000Z',
    };
    const domainRow = {
      ...databaseRow,
      createdAt: new Date(databaseRow.createdAt),
    };
    const limit = jest.fn().mockResolvedValue([databaseRow]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ select });
    (outboxMapper.toDomain as jest.Mock).mockReturnValue(domainRow);

    const result = await outboxRepo.findByIdAndType(
      id,
      EOutboxType.MissingOfficialFxRate,
      options
    );

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(outboxMapper.toDomain).toHaveBeenCalledWith(databaseRow);
    expect(result).toEqual(domainRow);
  });

  it('returns null when no row matches the application ID and type', async () => {
    const id = generateUUID();
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ select });

    const result = await outboxRepo.findByIdAndType(
      id,
      EOutboxType.MissingOfficialFxRate,
      options
    );

    expect(result).toBeNull();
    expect(outboxMapper.toDomain).not.toHaveBeenCalled();
  });

  it('deletes only the requested row and reports whether it was removed', async () => {
    const id = generateUUID();
    const returning = jest.fn().mockResolvedValue([{ id }]);
    const where = jest.fn().mockReturnValue({ returning });
    const deleteQuery = jest.fn().mockReturnValue({ where });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ delete: deleteQuery });

    await expect(outboxRepo.delete(id, options)).resolves.toBe(true);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(deleteQuery).toHaveBeenCalledWith(outboxInCore);
    expect(returning).toHaveBeenCalledWith({ id: outboxInCore.id });
  });

  it('reports false when the requested row was not removed', async () => {
    const id = generateUUID();
    const returning = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ returning });
    const deleteQuery = jest.fn().mockReturnValue({ where });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ delete: deleteQuery });

    await expect(outboxRepo.delete(id, options)).resolves.toBe(false);
  });
});
