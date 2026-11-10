import {
  ITransactionContext,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  IFxCostBasisLotDisposition,
  IFxCostBasisLotDispositionHistory,
} from '@domain/subledger/fx-cost-basis/types/disposition.types';

import {
  subledgerFxCostBasisLotDispositionHistoryInAudit,
  subledgerFxCostBasisLotDispositionsInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotDispositionRepo from '@infra/persistence/repos/subledger/fx-cost-basis/disposition.repo.impl';
import fxCostBasisLotDispositionHistoryMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition-history.mapper';
import fxCostBasisLotDispositionMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/disposition.mapper');
jest.mock('../mappers/disposition-history.mapper');

describe('FX Cost-Basis Lot Disposition Repo', () => {
  const payload = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'disposition-1',
  } as IFxCostBasisLotDisposition;
  const history = {
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    onBehalfOf: null,
    entityId: payload.id,
  } as IFxCostBasisLotDispositionHistory;
  const outerTx = 'outer-transaction' as unknown as ITransactionContext;
  const options: IWriteRepoOptions<IFxCostBasisLotDispositionHistory> = {
    correlationId: 'correlation-id',
    history,
    tx: outerTx,
  };

  beforeEach(() => jest.clearAllMocks());

  it('persists disposition and history in one transaction', async () => {
    const dispositionRow = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: payload.id,
    };
    const historyRow = {
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      onBehalfOf: null,
      dispositionId: payload.id,
    };
    const values = jest.fn().mockResolvedValue(undefined);
    const tx = { insert: jest.fn().mockReturnValue({ values }) };
    const query = {
      transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<void>) =>
          callback(tx)
      ),
    };
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
    jest
      .mocked(fxCostBasisLotDispositionMapper.toRepo)
      .mockReturnValue(
        dispositionRow as unknown as ReturnType<
          typeof fxCostBasisLotDispositionMapper.toRepo
        >
      );
    jest
      .mocked(fxCostBasisLotDispositionHistoryMapper.toRepo)
      .mockReturnValue(
        historyRow as unknown as ReturnType<
          typeof fxCostBasisLotDispositionHistoryMapper.toRepo
        >
      );

    await fxCostBasisLotDispositionRepo.create(payload, options);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenNthCalledWith(
      1,
      subledgerFxCostBasisLotDispositionsInCore
    );
    expect(tx.insert).toHaveBeenNthCalledWith(
      2,
      subledgerFxCostBasisLotDispositionHistoryInAudit
    );
    expect(values).toHaveBeenNthCalledWith(1, dispositionRow);
    expect(values).toHaveBeenNthCalledWith(2, historyRow);
    expect(fxCostBasisLotDispositionMapper.toRepo).toHaveBeenCalledWith(
      payload
    );
    expect(fxCostBasisLotDispositionHistoryMapper.toRepo).toHaveBeenCalledWith(
      history
    );
  });

  it('propagates database transaction failures unchanged', async () => {
    const databaseError = new Error('database unavailable');
    jest.mocked(getDbQueryHelper).mockReturnValue({
      transaction: jest.fn().mockRejectedValue(databaseError),
    } as unknown as ReturnType<typeof getDbQueryHelper>);

    await expect(
      fxCostBasisLotDispositionRepo.create(payload, options)
    ).rejects.toBe(databaseError);
  });

  it('propagates mapper failures unchanged', async () => {
    const mapperError = new Error('invalid disposition');
    const query = {
      transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({ insert: jest.fn() })
      ),
    };
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
    jest
      .mocked(fxCostBasisLotDispositionMapper.toRepo)
      .mockImplementation(() => {
        throw mapperError;
      });

    await expect(
      fxCostBasisLotDispositionRepo.create(payload, options)
    ).rejects.toBe(mapperError);
  });
});
