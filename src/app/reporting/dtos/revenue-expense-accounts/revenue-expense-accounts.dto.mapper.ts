import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import { IRevenueExpenseAccount } from '@app/reporting/types/revenue-expense-accounts.types';

import { IRevenueExpenseAccountDto } from './revenue-expense-accounts.dto';

function toDto(account: IRevenueExpenseAccount): IRevenueExpenseAccountDto {
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

export default Object.freeze({ toDto });
