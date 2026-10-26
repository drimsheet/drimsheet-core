import z from 'zod';

import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import paginationError from '@shared/values/pagination/pagination.error';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { IRevenueExpenseAndSuspenseAccountBalance } from './types';

function toDto(
  account: IRevenueExpenseAndSuspenseAccountBalance
): IRevenueExpenseAndSuspenseAccountBalanceDto {
  return {
    accountId: account.accountId,
    accountName: account.accountName,
    code: account.code,
    type: account.type,
    subType: account.subType,
    status: account.status,
    amount: moneyMapper.toDto(account.amount),
    sharePercentage: account.sharePercentage,
    transactionCount: account.transactionCount,
  };
}

export const revenueExpenseAndSuspenseAccountBalancesMapper = Object.freeze({
  toDto,
});

export interface IGetRevenueExpenseAndSuspenseAccountBalancesQuery extends Pick<
  IPaginationDto,
  'page' | 'limit' | 'search'
> {
  /** Omit for all revenue, expense and suspense posting accounts. */
  type?: 'revenue' | 'expense';
}

export interface IRevenueExpenseAndSuspenseAccountBalanceDto {
  accountId: string;
  accountName: string;
  code: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability';
  /** Suspense accounts supply the UI's Uncategorized rows. */
  subType: string;
  status: ULedgerAccountStatus;
  /** Current accumulated functional balance of this posting account. */
  amount: IMoneyDto;
  /** Share of root header balances of this type; null for suspense or a zero total. */
  sharePercentage: number | null;
  /** Journal lines on this posting account, including all journal states. */
  transactionCount: number;
}

export const getRevenueExpenseAndSuspenseAccountBalancesQueryValidationSchema =
  paginationDtoValidation
    .pick({ page: true, limit: true, search: true })
    .extend({
      page: paginationDtoValidation.shape.page
        .unwrap()
        .int(new paginationError.InvalidOffset().errorKey)
        .optional(),
      limit: paginationDtoValidation.shape.limit
        .unwrap()
        .int(new paginationError.InvalidLimit().errorKey)
        .optional(),
      type: z
        .enum(
          ['revenue', 'expense'],
          new ledgerAccountError.InvalidType().errorKey
        )
        .optional(),
    });
