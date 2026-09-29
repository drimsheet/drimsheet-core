import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICurrency } from '@domain/money/types/currency.types';

import { ILedgerAccount } from './ledger.types';
import {
  IPayableAccount,
  IStatutoryPayableAccountMeta,
  ITradePayableAccountMeta,
} from './liability-account.types';

interface ICreateHeaderPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
}

type TReturnType = TAuditedEntity<
  IPayableAccount,
  IPayableAccount,
  ILedgerAccount
>;

interface IStatutoryPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  currency: ICurrency;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
  meta: IStatutoryPayableAccountMeta;
}

interface ITradePayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
  meta: ITradePayableAccountMeta;
}

export interface IPayablesAccountService {
  createHeader(
    payload: ICreateHeaderPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TReturnType>;

  createStatutoryPayableSubAccount(payload: IStatutoryPayload): TReturnType;

  createTradePayableSubAccount(payload: ITradePayload): TReturnType;
}
