import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetRevenueExpenseAccountsQuery extends Pick<
  IPaginationDto,
  'page' | 'limit' | 'search'
> {
  /** Omit for all revenue, expense and suspense posting accounts. */
  type?: 'revenue' | 'expense';
}

export interface IRevenueExpenseAccountDto {
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
