import historyValue from '@shared/values/history/history.vo';

import actorEntity from '@domain/user/entities/actor.entity';
import actorError from '@domain/user/errors/actor.error';

import { mockActorHistoryRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { actorsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import actorRepo from '@infra/persistence/repos/user/actor.repo.impl';
import actorMapper from '@infra/persistence/repos/user/mappers/actor.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('@infra/persistence/repos/user/actor-history.repo.impl', () => ({
  __esModule: true,
  default: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
    .mockActorHistoryRepo,
}));
const [actor, , audit] = actorEntity.makeMigration();
const options = {
  correlationId: 'actors',
  history: historyValue.make(audit, actor.id, 'actors'),
};

function makeWrite() {
  const values = jest.fn().mockResolvedValue(undefined);
  const tx = { insert: jest.fn().mockReturnValue({ values }) };
  const query = {
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback(tx)
    ),
  };
  jest
    .mocked(getDbQueryHelper)
    .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
  return { tx, values };
}

describe('actor repository', () => {
  beforeEach(() => jest.resetAllMocks());
  it('inserts the actor before history within the same transaction', async () => {
    const { tx, values } = makeWrite();
    await actorRepo.create(actor, options);
    expect(tx.insert).toHaveBeenCalledWith(actorsInCore);
    expect(values).toHaveBeenCalledWith(actorMapper.toRepo(actor));
    expect(mockActorHistoryRepo.save).toHaveBeenCalledWith(options.history, {
      ...options,
      tx,
    });
    expect(values.mock.invocationCallOrder[0]).toBeLessThan(
      mockActorHistoryRepo.save.mock.invocationCallOrder[0]
    );
  });
  it.each(['actors_username_key', 'actors_owner_name_key'])(
    'maps a wrapped %s uniqueness failure',
    async (constraint) => {
      const { values } = makeWrite();
      values.mockRejectedValue({ cause: { code: '23505', constraint } });
      await expect(actorRepo.create(actor, options)).rejects.toThrow(
        actorError.UsernameConflict
      );
      expect(mockActorHistoryRepo.save).not.toHaveBeenCalled();
    }
  );
  it.each([
    null,
    'failure',
    new Error('storage'),
    { code: '23505', constraint: 'actors_pkey' },
  ])('propagates other storage failures', async (failure) => {
    const { values } = makeWrite();
    values.mockRejectedValue(failure);
    await expect(actorRepo.create(actor, options)).rejects.toBe(failure);
  });
  it('propagates history failures to roll back its transaction', async () => {
    makeWrite();
    const failure = new Error('history failed');
    mockActorHistoryRepo.save.mockRejectedValue(failure);
    await expect(actorRepo.create(actor, options)).rejects.toBe(failure);
  });
  it.each(['findById', 'findByUsername'] as const)(
    'reads disabled identities and missing rows through %s',
    async (method) => {
      const disabled = { ...actor, status: 'disabled' as const };
      const where = jest.fn().mockResolvedValue([actorMapper.toRepo(disabled)]);
      const query = {
        select: jest
          .fn()
          .mockReturnValue({ from: jest.fn().mockReturnValue({ where }) }),
      };
      jest
        .mocked(getDbQueryHelper)
        .mockReturnValue(
          query as unknown as ReturnType<typeof getDbQueryHelper>
        );
      const read = () =>
        method === 'findById'
          ? actorRepo.findById(actor.id, options)
          : actorRepo.findByUsername(actor.username, options);
      await expect(read()).resolves.toEqual(disabled);
      where.mockResolvedValue([]);
      await expect(read()).resolves.toBeNull();
    }
  );
});
