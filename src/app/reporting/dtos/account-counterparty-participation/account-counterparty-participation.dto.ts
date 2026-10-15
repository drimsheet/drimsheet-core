import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { ICounterpartyDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetAccountCounterpartyParticipationQuery extends Pick<
  IPaginationDto,
  'page' | 'limit' | 'search'
> {}

export interface IAccountCounterpartyParticipationDto {
  counterparty: ICounterpartyDto | null;
  /** True only for transfer lines without a counterparty. */
  isSelf: boolean;
  participation: {
    /** Net contribution in account currency, or functional currency when unset. */
    amount: IMoneyDto;
    functionalAmount: IMoneyDto;
    /** Percentage of the stored account balance, before filtering; null at zero. */
    totalShare: number | null;
  };
}
