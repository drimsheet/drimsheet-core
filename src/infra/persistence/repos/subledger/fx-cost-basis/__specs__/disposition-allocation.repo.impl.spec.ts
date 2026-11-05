import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IFxCostBasisLotDispositionAllocation } from '@domain/subledger/fx-cost-basis/types/disposition.types';

import { subledgerFxCostBasisLotDispositionAllocationsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotDispositionAllocationRepo from '@infra/persistence/repos/subledger/fx-cost-basis/disposition-allocation.repo.impl';
import fxCostBasisLotDispositionAllocationMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition-allocation.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/disposition-allocation.mapper');

describe('FX Cost-Basis Lot Disposition Allocation Repo', () => {
  const payload = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'allocation-1',
  } as IFxCostBasisLotDispositionAllocation;
  const outerTx = 'outer-transaction' as unknown as ITransactionContext;
  const options = { correlationId: 'correlation-id', tx: outerTx };

  beforeEach(() => jest.clearAllMocks());

  it('persists the mapped allocation through the supplied transaction', async () => {
    const allocationRow = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: payload.id,
    };
    const values = jest.fn().mockResolvedValue(undefined);
    const query = { insert: jest.fn().mockReturnValue({ values }) };
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
    jest
      .mocked(fxCostBasisLotDispositionAllocationMapper.toRepo)
      .mockReturnValue(
        allocationRow as unknown as ReturnType<
          typeof fxCostBasisLotDispositionAllocationMapper.toRepo
        >
      );

    await fxCostBasisLotDispositionAllocationRepo.create(payload, options);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(
      fxCostBasisLotDispositionAllocationMapper.toRepo
    ).toHaveBeenCalledWith(payload);
    expect(query.insert).toHaveBeenCalledWith(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    );
    expect(values).toHaveBeenCalledWith(allocationRow);
  });

  it('propagates database failures unchanged', async () => {
    const databaseError = new Error('database unavailable');
    const query = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockRejectedValue(databaseError),
      }),
    };
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
    jest
      .mocked(fxCostBasisLotDispositionAllocationMapper.toRepo)
      .mockReturnValue({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: payload.id,
      } as unknown as ReturnType<
        typeof fxCostBasisLotDispositionAllocationMapper.toRepo
      >);

    await expect(
      fxCostBasisLotDispositionAllocationRepo.create(payload, options)
    ).rejects.toBe(databaseError);
  });

  it('propagates mapper failures unchanged', async () => {
    const mapperError = new Error('invalid allocation');
    jest
      .mocked(fxCostBasisLotDispositionAllocationMapper.toRepo)
      .mockImplementation(() => {
        throw mapperError;
      });

    await expect(
      fxCostBasisLotDispositionAllocationRepo.create(payload, options)
    ).rejects.toBe(mapperError);
  });
});
