import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IBalanceSeriesQueryRepo from '@app/reporting/contracts/balance-series.query.repo.contract';
import {
  IBalancesByAccountDto,
  IGetBalancesByAccountQuery,
} from '@app/reporting/dtos/balance-series/balance-series.dto';
import { getBalancesByAccountQueryValidationSchema } from '@app/reporting/dtos/balance-series/balance-series.dto.validation';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import reportingError from '@app/reporting/errors/reporting.error';
import buildBalanceSeriesHelper from '@app/reporting/usecases/helpers/build-balance-series.helper';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  balanceSeriesQueryRepo: IBalanceSeriesQueryRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
}

export default function makeGetBalancesByAccountUsecase(deps: IDependencies) {
  return async (
    query: IGetBalancesByAccountQuery
  ): Promise<IBalancesByAccountDto> => {
    zodValidationRunner(getBalancesByAccountQueryValidationSchema, query);

    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const accountIds = [...new Set(query.accountIds)];

    for (const accountId of accountIds) {
      const account = await deps.ledgerAccountRepo.findById(
        accountId as TEntityId,
        accountingEntity.id,
        { correlationId }
      );
      if (!account) {
        throw new reportingError.AccountNotFound();
      }
    }

    const aggregates = await deps.balanceSeriesQueryRepo.aggregate(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        filter: { accountIds },
      },
      { correlationId }
    );
    return buildBalanceSeriesHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'account'
    );
  };
}
