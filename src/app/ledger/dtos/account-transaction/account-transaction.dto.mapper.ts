import { IAccountTransaction } from '@domain/journal-entry/types/account-transaction.types';

import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { IAccountTransactionDto } from './account-transaction.dto';

const accountTransactionMapper = {
  toDto(payload: IAccountTransaction): IAccountTransactionDto {
    return {
      id: payload.id,
      entryId: payload.entryId,
      accountId: payload.accountId,
      counterpartyId: payload.counterpartyId,
      sequenceOrder: payload.sequenceOrder,
      amount: moneyMapper.toDto(payload.amount),
      exchangeRate: payload.exchangeRate,
      functionalAmount: moneyMapper.toDto(payload.functionalAmount),
      side: payload.side,
      description: payload.description,
      createdBy: payload.createdBy,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      header: {
        sourceType: payload.header.sourceType,
        memo: payload.header.memo,
        status: payload.header.status,
        effectiveDate: payload.header.effectiveDate,
        postedAt: payload.header.postedAt,
        voidedAt: payload.header.voidedAt,
        voidingEntryId: payload.header.voidingEntryId,
        createdBy: payload.header.createdBy,
        createdAt: payload.header.createdAt,
        updatedAt: payload.header.updatedAt,
      },
    };
  },
};

export default accountTransactionMapper;
