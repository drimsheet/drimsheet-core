import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IFxCostBasisLot } from '@domain/subledger/fx-cost-basis/types/lot.types';

import { subledgerFxCostBasisLotsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotRepo from '@infra/persistence/repos/subledger/fx-cost-basis/lot.repo.impl';
import fxCostBasisLotHistoryMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/lot-history.mapper';
import fxCostBasisLotMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/lot.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/lot.mapper');
jest.mock('../mappers/lot-history.mapper');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return { ...drizzle, eq: jest.fn(drizzle.eq) };
});

describe('FX Cost-Basis Lot Repo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads open account lots in repository FIFO order', async () => {
    const row = { id: 'row' };
    const lot = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
    } as IFxCostBasisLot;
    const orderedQuery = {
      then: (resolve: (value: unknown[]) => void) => resolve([row]),
    };
    const orderBy = jest.fn().mockReturnValue(orderedQuery);
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    jest.mocked(getDbQueryHelper).mockReturnValue({
      select,
    } as unknown as ReturnType<typeof getDbQueryHelper>);
    jest.mocked(fxCostBasisLotMapper.toDomain).mockReturnValue(lot);
    const accountingEntityId = generateUUID();
    const accountId = generateUUID();
    const options = { correlationId: 'corr-id' };

    await expect(
      fxCostBasisLotRepo.findOpenByAccountId(
        accountingEntityId,
        accountId,
        options
      )
    ).resolves.toEqual([lot]);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(jest.mocked(fxCostBasisLotMapper.toDomain).mock.calls[0][0]).toBe(
      row
    );
  });

  it('updates a lot and appends its history in one repository transaction', async () => {
    const lot = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      version: 2,
    } as IFxCostBasisLot;
    const history = { entityId: lot.id, entityVersion: 2 } as never;
    const lotRow = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: lot.id,
      version: lot.version,
    } as never;
    const historyRow = {
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      onBehalfOf: null,
      lotId: lot.id,
    } as never;
    const where = jest.fn().mockResolvedValue({ rowCount: 1 });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    const tx = { update, insert };
    jest.mocked(getDbQueryHelper).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
    } as unknown as ReturnType<typeof getDbQueryHelper>);
    jest.mocked(fxCostBasisLotMapper.toRepo).mockReturnValue(lotRow);
    jest.mocked(fxCostBasisLotHistoryMapper.toRepo).mockReturnValue(historyRow);

    await fxCostBasisLotRepo.update(lot, {
      correlationId: 'corr-id',
      history,
      expectedVersion: 1,
    });

    expect(set).toHaveBeenCalledWith(lotRow);
    expect(eq).toHaveBeenCalledWith(subledgerFxCostBasisLotsInCore.version, 1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith([historyRow]);
  });

  it('throws a version conflict without appending history for a stale update', async () => {
    const lot = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      version: 2,
    } as IFxCostBasisLot;
    const history = { entityId: lot.id, entityVersion: 2 } as never;
    const where = jest.fn().mockResolvedValue({ rowCount: 0 });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    const tx = { update, insert };
    jest.mocked(getDbQueryHelper).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
    } as unknown as ReturnType<typeof getDbQueryHelper>);

    await expect(
      fxCostBasisLotRepo.update(lot, {
        correlationId: 'corr-id',
        history,
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);

    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a history-version mismatch before opening a transaction', async () => {
    const lot = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      version: 2,
    } as IFxCostBasisLot;

    await expect(
      fxCostBasisLotRepo.update(lot, {
        correlationId: 'corr-id',
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: lot.id,
          entityVersion: 3,
        } as never,
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);

    expect(getDbQueryHelper).not.toHaveBeenCalled();
  });
});
