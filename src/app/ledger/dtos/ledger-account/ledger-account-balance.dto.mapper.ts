import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';

import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { ILedgerAccountBalanceDto } from './ledger-account-balance.dto';

const ledgerAccountBalanceMapper = {
  toDto(balance: ILedgerAccountBalance): ILedgerAccountBalanceDto {
    return {
      createdBy: balance.createdBy,
      ledgerAccountId: balance.ledgerAccountId,
      accountingEntityId: balance.accountingEntityId,
      accountMaterializedPath: balance.accountMaterializedPath,
      amount: moneyMapper.toDto(balance.amount),
      functionalAmount: moneyMapper.toDto(balance.functionalAmount),
      version: balance.version,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    };
  },
};

export default ledgerAccountBalanceMapper;
