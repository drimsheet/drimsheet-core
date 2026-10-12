import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import { IAccountCashFlowReport } from '@app/reporting/types/account-cash-flow.types';

import { IAccountCashFlowDto } from './account-cash-flow.dto';

function toDto(
  accountId: string,
  report: IAccountCashFlowReport
): IAccountCashFlowDto {
  return {
    accountId,
    currencyCode: report.totalMoneyIn.currency.code,
    period: { from: report.period.from, to: report.period.to },
    totalMoneyIn: moneyMapper.toDto(report.totalMoneyIn),
    totalMoneyOut: moneyMapper.toDto(report.totalMoneyOut),
    buckets: report.buckets.map((bucket) => ({
      from: bucket.from,
      to: bucket.to,
      moneyIn: moneyMapper.toDto(bucket.moneyIn),
      moneyOut: moneyMapper.toDto(bucket.moneyOut),
    })),
  };
}

export default Object.freeze({ toDto });
