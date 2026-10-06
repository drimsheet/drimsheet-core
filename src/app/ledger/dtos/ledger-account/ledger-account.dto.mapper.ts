import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IMoney } from '@domain/money/types/money.types';

import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { ILedgerAccountDto } from './ledger-account.dto';

const ledgerAccountMapper = {
  toDto(
    payload: ILedgerAccount,
    balance: IMoney,
    functionalBalance: IMoney
  ): ILedgerAccountDto {
    return {
      id: payload.id,
      code: payload.code,
      materializedPath: payload.materializedPath,
      accountingEntityId: payload.accountingEntityId,
      type: payload.type,
      normalBalance: payload.normalBalance,
      subType: payload.subType,
      behavior: payload.behavior as ULedgerAccountBehavior,
      isControlAccount: payload.isControlAccount,
      controlAccountId: payload.controlAccountId ?? undefined,
      name: payload.name,
      status: payload.status,
      contraAccountRule: payload.contraAccountRule,
      adjunctAccountRule: payload.adjunctAccountRule,
      openingBalanceDate: payload.openingBalanceDate ?? null,
      createdBy: payload.createdBy,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      deletedAt: payload.deletedAt ?? undefined,
      balance: moneyMapper.toDto(balance),
      functionalBalance: moneyMapper.toDto(functionalBalance),
    };
  },
};

export default ledgerAccountMapper;
