import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingError from '@app/ledger/errors/reporting.error';
import type { TGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery } from '@app/ledger/usecases/reporting/current-asset-and-liability-balances-by-currency/current-asset-and-liability-balances-by-currency.usecase';
import makeGetCurrentAssetAndLiabilityBalancesByCurrencyUsecase, {
  IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryOutput,
} from '@app/ledger/usecases/reporting/current-asset-and-liability-balances-by-currency/current-asset-and-liability-balances-by-currency.usecase';
import { getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema } from '@app/ledger/usecases/reporting/current-asset-and-liability-balances-by-currency/dto';

const mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery: jest.MockedFunction<TGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery> =
  jest.fn();

describe('get-current-asset-and-liability-balances-by-currency.usecase.spec', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const account: IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryOutput =
    {
      accountId: 'bank',
      currencyCode: 'USD',
      amount: 100_000n,
      functionalAmount: 150_000_000n,
    };

  describe('getCurrentAssetAndLiabilityBalancesByCurrencyUsecase', () => {
    const usecase = makeGetCurrentAssetAndLiabilityBalancesByCurrencyUsecase({
      appContext: mockAppContext,
      repoQuery: mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery,
    });

    beforeEach(() => {
      jest.resetAllMocks();
      mockAppContext.get.mockReturnValue({
        accountingEntity: {
          id: entityId,
          functionalCurrencyCode: 'NGN',
        } as IAccountingEntity,
        correlationId: 'currency-balances-spec',
        idempotencyKey: '',
        clientSession: mockClientSession,
      });
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        []
      );
    });

    it.each(['asset', 'liability'] as const)(
      'reads only the requested %s class and returns an empty report without type',
      async (type) => {
        expect(await usecase(type)).toEqual({
          totalFunctionalBalance: {
            amount: 0,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          balancesByCurrency: [],
        });
        expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
        expect(
          mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery
        ).toHaveBeenCalledTimes(1);
        expect(
          mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery
        ).toHaveBeenCalledWith(
          {
            accountingEntityId: entityId,
            type: type,
            functionalCurrencyCode: 'NGN',
          },
          {
            correlationId: 'currency-balances-spec',
          }
        );
      }
    );

    it('groups repeated currencies, preserves recorded valuations and reconciles the total', async () => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [
          account,
          {
            accountId: 'local-bank',
            currencyCode: 'NGN',
            amount: 100_000_000n,
            functionalAmount: 100_000_000n,
          },
          {
            ...account,
            accountId: 'dollar-savings',
            amount: 50_000n,
            functionalAmount: 70_000_000n,
          },
        ]
      );

      expect(await usecase('asset')).toEqual({
        totalFunctionalBalance: {
          amount: 320_000_000,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        balancesByCurrency: [
          {
            balance: {
              amount: 100_000_000,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
            functionalBalance: {
              amount: 100_000_000,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          },
          {
            balance: {
              amount: 150_000,
              currencyCode: 'USD',
              isMinorUnit: true,
            },
            functionalBalance: {
              amount: 220_000_000,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          },
        ],
      });
    });

    it('keeps zero currency groups and signed balances without applying FX rates', async () => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [
          { ...account, amount: 30n, functionalAmount: 400n },
          {
            ...account,
            accountId: 'offset',
            amount: -30n,
            functionalAmount: -500n,
          },
          {
            accountId: 'zero',
            currencyCode: 'JPY',
            amount: 0n,
            functionalAmount: 0n,
          },
        ]
      );
      const response = await usecase('liability');
      expect(response.totalFunctionalBalance.amount).toBe(-100);
      expect(response.balancesByCurrency).toEqual([
        {
          balance: { amount: 0, currencyCode: 'JPY', isMinorUnit: true },
          functionalBalance: {
            amount: 0,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
        {
          balance: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
          functionalBalance: {
            amount: -100,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });

    it('returns signed native and functional minor-unit DTOs without extra fields', async () => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [{ ...account, amount: -100n, functionalAmount: -1500n }]
      );

      expect(await usecase('asset')).toEqual({
        totalFunctionalBalance: {
          amount: -1500,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        balancesByCurrency: [
          {
            balance: { amount: -100, currencyCode: 'USD', isMinorUnit: true },
            functionalBalance: {
              amount: -1500,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          },
        ],
      });
    });

    it('uses the entity functional currency even when there are no accounts', async () => {
      mockAppContext.get.mockReturnValue({
        accountingEntity: {
          id: entityId,
          functionalCurrencyCode: 'JPY',
        } as IAccountingEntity,
        correlationId: 'currency-balances-spec',
        idempotencyKey: '',
        clientSession: mockClientSession,
      });
      expect(await usecase('asset')).toEqual({
        totalFunctionalBalance: {
          amount: 0,
          currencyCode: 'JPY',
          isMinorUnit: true,
        },
        balancesByCurrency: [],
      });
    });

    it.each([
      undefined,
      null,
      '',
      'revenue',
      'expense',
      'equity',
      'ASSET',
      ['asset'],
    ])(
      'rejects invalid type %j before context or storage reads',
      async (type) => {
        await expect(
          usecase(type as Parameters<typeof usecase>[0])
        ).rejects.toThrow(appError.UnprocessableEntity);
        expect(mockAppContext.get).not.toHaveBeenCalled();
        expect(
          mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery
        ).not.toHaveBeenCalled();
      }
    );

    it.each([
      { amount: null, functionalAmount: null },
      { amount: null, functionalAmount: 10n },
      { amount: 10n, functionalAmount: null },
    ])('rejects an incomplete stored balance %p', async (amounts) => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [{ ...account, ...amounts }]
      );
      await expect(usecase('asset')).rejects.toThrow(
        ledgerAppError.BalanceNotFound
      );
    });

    it.each([
      { amount: 100_000_000_000_001n },
      { amount: -100_000_000_000_001n },
      { functionalAmount: 100_000_000_000_001n },
      { functionalAmount: -100_000_000_000_001n },
      { currencyCode: 'JPY', amount: 1_000_000_000_001n },
    ])('enforces each currency amount ceiling for %p', async (amounts) => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [{ ...account, ...amounts }]
      );
      await expect(usecase('asset')).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it.each([
      { amount: 60_000_000_000_000n, functionalAmount: 1n },
      { amount: 1n, functionalAmount: 60_000_000_000_000n },
    ])('checks grouped balances after aggregation %p', async (amounts) => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [
          { ...account, ...amounts },
          { ...account, accountId: 'second', ...amounts },
        ]
      );
      await expect(usecase('asset')).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it('checks the total across currencies even when individual groups are within limits', async () => {
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockResolvedValue(
        [
          { ...account, functionalAmount: 60_000_000_000_000n },
          {
            ...account,
            accountId: 'euro',
            currencyCode: 'EUR',
            functionalAmount: 60_000_000_000_000n,
          },
        ]
      );
      await expect(usecase('asset')).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it('propagates storage failures', async () => {
      const failure = new Error('read failed');
      mockCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery.mockRejectedValue(
        failure
      );
      await expect(usecase('asset')).rejects.toBe(failure);
    });
  });
});

describe('current-asset-and-liability-balances-by-currency.dto.validation.test', () => {
  describe('getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema', () => {
    it.each(['asset', 'liability'])('accepts %s', (type) => {
      expect(
        getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema.parse(
          {
            type,
          }
        )
      ).toEqual({ type });
    });

    it.each([
      undefined,
      null,
      '',
      'equity',
      'revenue',
      'expense',
      'ASSET',
      1,
      ['asset'],
    ])('rejects %j with the ledger type field error', (type) => {
      const result =
        getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema.safeParse(
          {
            type,
          }
        );
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['type'],
          message: new ledgerAccountError.InvalidType().errorKey,
        }),
      ]);
    });
  });
});
