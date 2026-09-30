import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICurrency } from '@domain/money/types/currency.types';

import { IReceivablesAccount } from './asset-account.types';
import { ILedgerAccount } from './ledger.types';

type TReturnType = TAuditedEntity<
  IReceivablesAccount,
  IReceivablesAccount,
  ILedgerAccount
>;

interface ICreateHeaderPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
}

interface ICreateReceivableSubAccountPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  currency: ICurrency;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
}

export interface IReceivablesAccountService {
  createHeader(
    payload: ICreateHeaderPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TReturnType>;

  createStatutoryReceivableSubAccount(
    payload: ICreateReceivableSubAccountPayload
  ): TReturnType;

  createTradeReceivableSubAccount(
    payload: ICreateReceivableSubAccountPayload
  ): TReturnType;
}
