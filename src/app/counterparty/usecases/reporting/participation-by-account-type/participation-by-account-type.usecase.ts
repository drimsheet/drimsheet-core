/**
 * Returns one counterparty's net revenue and expense participation
 * for the full fiscal year in functional currency. Reads authoritative journal
 * lines once, independently of balance propagation. Includes posted opening
 * balances, archived entries, voided originals and reversals on their own
 * effective dates; excludes never-posted entries. No activity returns zeros.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import dateRangeValue from '@shared/values/date-range/date-range.vo';
import { IDateRange } from '@shared/values/date-range/types/date-range.types';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import getLedgerAccountNormalBalanceHelper from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  getCounterpartyAccountTypeParticipationQueryValidationSchema,
  ICounterpartyAccountTypeParticipationDto,
  IGetCounterpartyAccountTypeParticipationQuery,
} from './dto';
import counterpartyReportingError from './error';

export interface IGetCounterpartyAccountTypeParticipationRepoQueryInput {
  accountingEntityId: TEntityId;
  counterpartyId: TEntityId;
  currencyCode: string;
  period: IDateRange;
}

export interface IGetCounterpartyAccountTypeParticipationRepoQueryOutput {
  // TODO: Include liability participation when AP/AR is available.
  type: 'revenue' | 'expense';
  debits: bigint;
  credits: bigint;
}

export type TGetCounterpartyAccountTypeParticipationRepoQuery = (
  input: IGetCounterpartyAccountTypeParticipationRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetCounterpartyAccountTypeParticipationRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  fiscalYearRepo: IFiscalYearRepo;
  repoQuery: TGetCounterpartyAccountTypeParticipationRepoQuery;
}

export default function makeGetCounterpartyAccountTypeParticipationUsecase(
  deps: IDependencies
) {
  return async (
    counterpartyId: string,
    query: IGetCounterpartyAccountTypeParticipationQuery
  ): Promise<ICounterpartyAccountTypeParticipationDto> => {
    stringUtils.validateUUID(
      counterpartyId,
      counterpartyError.InvalidCounterpartyId
    );
    zodValidationRunner(
      getCounterpartyAccountTypeParticipationQueryValidationSchema,
      query
    );

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const options = { correlationId };
    const counterparty = await deps.counterpartyRepo.findById(
      counterpartyId as TEntityId,
      accountingEntity.id,
      options
    );
    if (!counterparty) {
      throw new counterpartyReportingError.CounterpartyNotFound();
    }
    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
      query.fiscalYearId as TEntityId,
      options
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    const period = dateRangeValue.make({
      from: fiscalYear.startDate,
      to: fiscalYear.endDate,
    });
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const aggregates = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        counterpartyId: counterparty.id,
        currencyCode: currency.code,
        period,
      },
      options
    );

    return {
      counterpartyId: counterparty.id,
      fiscalYearId: fiscalYear.id,
      period: dateRangeMapper.toDto(period),
      revenue: buildNetAmount(aggregates, 'revenue', currency),
      expense: buildNetAmount(aggregates, 'expense', currency),
    };
  };
}

/** Nets by account class so contra activity offsets the class's normal side. */
function buildNetAmount(
  aggregates: IGetCounterpartyAccountTypeParticipationRepoQueryOutput[],
  type: IGetCounterpartyAccountTypeParticipationRepoQueryOutput['type'],
  currency: ICurrency
) {
  const aggregate = aggregates.find((row) => row.type === type);
  const debits = moneyValue.make(aggregate?.debits ?? 0n, currency, true);
  const credits = moneyValue.make(aggregate?.credits ?? 0n, currency, true);
  const amount =
    getLedgerAccountNormalBalanceHelper(type) === 'debit'
      ? moneyValue.subtract(debits, credits)
      : moneyValue.subtract(credits, debits);
  reportingValidation.validateAmountLimit(amount);
  reportingValidation.validateSafeAmount(amount);
  return moneyMapper.toDto(amount);
}
