import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetAssetLiabilityAccountParticipationQuery extends Pick<
  IPaginationDto,
  'page' | 'limit' | 'search'
> {
  /** Omit for both asset and liability posting accounts. */
  type?: 'asset' | 'liability';
}

export interface IAssetLiabilityAccountParticipationDto {
  accountId: string;
  accountName: string;
  code: string;
  type: 'asset' | 'liability';
  subType: string;
  status: ULedgerAccountStatus;
  /** Current signed functional balance of this posting account. */
  amount: IMoneyDto;
  /**
   * Percentage of all root balances of the same type before filtering or
   * pagination, rounded to two decimals; null when that total is zero.
   */
  sharePercentage: number | null;
}
