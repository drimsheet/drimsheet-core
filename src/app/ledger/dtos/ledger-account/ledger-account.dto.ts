import { TEntityId } from '@shared/types/uuid';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import {
  ULedgerAccountCurrencyUpdateReason,
  ULedgerAccountDeletionReason,
} from '@domain/ledger/types/ledger-account.service.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import {
  UAdjunctAccountRule,
  UContraAccountRule,
  ULedgerAccountStatus,
  ULedgerType,
  UNormalBalance,
} from '@domain/ledger/types/ledger.types';

import { ULedgerAccountSortBy } from '@app/ledger/contracts/ledger-account.query.repo.contract';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetLedgerAccountsQuery extends IPaginationDto {
  statuses?: ULedgerAccountStatus[];
  types?: ULedgerType[];
  subTypes?: ULedgerAccountSubType[];
  behavior?: string;
  isControlAccount?: boolean;
  orderBy?: ULedgerAccountSortBy;
}

export type TLedgerAccountCurrencyUpdateEligibilityDto =
  | { canUpdateCurrency: true }
  | { canUpdateCurrency: false; reason: ULedgerAccountCurrencyUpdateReason };

export type TLedgerAccountDeletionEligibilityDto =
  | { canDelete: true }
  | { canDelete: false; reason: ULedgerAccountDeletionReason };

export interface ILedgerAccountDto {
  id: TEntityId;
  code: string;
  materializedPath: string;
  accountingEntityId: TEntityId;
  type: ULedgerType;
  normalBalance: UNormalBalance;
  subType: ULedgerAccountSubType;
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
