import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { IAccountCashFlowReport } from '@app/reporting/types/account-cash-flow.types';

import { IAccountCashFlowDto } from './account-cash-flow.dto';

function toDto(
  accountId: string,
  report: IAccountCashFlowReport
): IAccountCashFlowDto {
  return {
    accountId,
    currencyCode: report.totalMoneyIn.currency.code,
    period: dateRangeMapper.toDto(report.period),
    totalMoneyIn: moneyMapper.toDto(report.totalMoneyIn),
    totalMoneyOut: moneyMapper.toDto(report.totalMoneyOut),
    buckets: report.buckets.map((bucket) => {
      const range = dateRangeMapper.toDto(bucket);
      return {
        from: range.from,
        to: range.to,
        moneyIn: moneyMapper.toDto(bucket.moneyIn),
        moneyOut: moneyMapper.toDto(bucket.moneyOut),
      };
    }),
  };
}

export default Object.freeze({ toDto });
