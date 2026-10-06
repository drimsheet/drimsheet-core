import { TEntityId } from '@shared/types/uuid';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { ULedgerAccountSortBy } from '@domain/ledger/repos/ledger-account.repo';
import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import {
  UAdjunctAccountRule,
  UContraAccountRule,
  ULedgerAccountStatus,
  ULedgerType,
  UNormalBalance,
} from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetLedgerAccountsQuery extends IPaginationDto {
  status?: ULedgerAccountStatus;
  type?: ULedgerType;
  subType?: ULedgerAccountSubType;
  behavior?: string;
  isControlAccount?: boolean;
  orderBy?: ULedgerAccountSortBy;
}

export interface ILedgerAccountDto {
  id: TEntityId;
  code: string;
  materializedPath: string;
  accountingEntityId: TEntityId;
  type: ULedgerType;
  normalBalance: UNormalBalance;
  subType: any;
  behavior: ULedgerAccountBehavior;
  isControlAccount: boolean;
  controlAccountId?: TEntityId;
  name: string;
  status: ULedgerAccountStatus;
  contraAccountRule: UContraAccountRule;
  adjunctAccountRule: UAdjunctAccountRule;
  openingBalanceDate: Date | null;
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  balance: IMoneyDto;
  functionalBalance: IMoneyDto;
}
