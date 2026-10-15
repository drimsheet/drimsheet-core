import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import { IAccountCounterpartyParticipation } from '@app/reporting/types/account-counterparty-participation.types';

import { IAccountCounterpartyParticipationDto } from './account-counterparty-participation.dto';

function toDto(
  row: IAccountCounterpartyParticipation
): IAccountCounterpartyParticipationDto {
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

export default Object.freeze({ toDto });
