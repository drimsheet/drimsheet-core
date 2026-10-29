import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetCurrentTotalBalanceByTypeUsecase, {
  TGetCurrentTotalBalanceByTypeRepoQuery,
} from './current-total-balance-by-type.usecase';

const repoQuery: jest.MockedFunction<TGetCurrentTotalBalanceByTypeRepoQuery> =
  jest.fn();
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const usecase = makeGetCurrentTotalBalanceByTypeUsecase({
  appContext: mockAppContext,
  repoQuery,
});

describe('getCurrentTotalBalanceByTypeUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'total-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    repoQuery.mockResolvedValue([]);
  });

  it.each(Object.values(ELedgerType))(
    'returns zero for an empty %s report in entity currency',
    async (type) => {
      expect(await usecase(type)).toEqual({
        totalFunctionalBalance: {
          amount: 0,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      });
      expect(repoQuery).toHaveBeenCalledWith(
        { accountingEntityId: entityId, type, functionalCurrencyCode: 'NGN' },
        { correlationId: 'total-spec' }
      );
    }
  );

  it.each([
    [-100n, 30n, -70],
    [100n, -100n, 0],
    [100n, 30n, 130],
  ] as const)(
    'sums signed header balances %s and %s',
    async (first, second, expected) => {
      repoQuery.mockResolvedValue([
        { accountId: 'first', functionalAmount: first },
        { accountId: 'second', functionalAmount: second },
      ]);
      expect(await usecase('asset')).toEqual({
        totalFunctionalBalance: {
          amount: expected,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      });
    }
  );

  it.each([undefined, null, '', 'ASSET', 'invalid', ['asset']])(
    'rejects invalid type %j before reads',
    async (type) => {
      await expect(
        usecase(type as Parameters<typeof usecase>[0])
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(repoQuery).not.toHaveBeenCalled();
      expect(mockAppContext.get).not.toHaveBeenCalled();
    }
  );

  it('rejects a missing header balance', async () => {
    repoQuery.mockResolvedValue([
      { accountId: 'missing', functionalAmount: null },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );
  });

  it.each([100_000_000_000_001n, -100_000_000_000_001n])(
    'rejects out-of-range header amounts %s',
    async (functionalAmount) => {
      repoQuery.mockResolvedValue([{ accountId: 'header', functionalAmount }]);
      await expect(usecase('asset')).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    }
  );

  it('checks the combined total against the amount limit', async () => {
    repoQuery.mockResolvedValue([
      { accountId: 'first', functionalAmount: 60_000_000_000_000n },
      { accountId: 'second', functionalAmount: 60_000_000_000_000n },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  it('propagates query failure', async () => {
    const failure = new Error('read failed');
    repoQuery.mockRejectedValue(failure);
    await expect(usecase('asset')).rejects.toBe(failure);
  });
});
