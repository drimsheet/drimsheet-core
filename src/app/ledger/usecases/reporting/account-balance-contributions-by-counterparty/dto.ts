import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import paginationError from '@shared/values/pagination/pagination.error';

import { ICounterpartyDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { IAccountBalanceContributionsByCounterparty } from './types';

export interface IGetAccountBalanceContributionsByCounterpartyQuery
  extends
    Pick<IPaginationDto, 'page' | 'limit' | 'search'>,
    Partial<IDateRangeDto> {}

export interface IAccountBalanceContributionsByCounterpartyDto {
  counterparty: ICounterpartyDto | null;
  /** True only for transfer lines without a counterparty. */
  isSelf: boolean;
  participation: {
    /** Net contribution in account currency, or functional currency when unset. */
    amount: IMoneyDto;
    functionalAmount: IMoneyDto;
    /**
     * Percentage of period net activity when dates are supplied, otherwise the
     * stored balance. Calculated before search/pagination; null at zero.
     */
    totalShare: number | null;
  };
}

export const getAccountBalanceContributionsByCounterpartyQueryValidationSchema =
  paginationDtoValidation
    .pick({ page: true, limit: true, search: true })
    .extend({
      from: dateRangeValidationSchema.shape.from.optional(),
      to: dateRangeValidationSchema.shape.to.optional(),
      page: paginationDtoValidation.shape.page
        .unwrap()
        .int(new paginationError.InvalidOffset().errorKey)
        .optional(),
      limit: paginationDtoValidation.shape.limit
        .unwrap()
        .int(new paginationError.InvalidLimit().errorKey)
        .optional(),
    });

function toDto(
  row: IAccountBalanceContributionsByCounterparty
): IAccountBalanceContributionsByCounterpartyDto {
  return {
    counterparty: row.counterparty
      ? counterpartyDtoMapper.toDto(row.counterparty)
      : null,
    isSelf: row.isSelf,
    participation: {
      amount: moneyMapper.toDto(row.amount),
      functionalAmount: moneyMapper.toDto(row.functionalAmount),
      totalShare: row.totalShare,
    },
  };
}

export const accountBalanceContributionsByCounterpartyMapper = Object.freeze({
  toDto,
});
