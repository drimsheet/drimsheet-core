import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { IIncomeTaxExpenseAccount } from './expense-account.types';
import { ILedgerAccount } from './ledger.types';

type TReturnType = TAuditedEntity<
  IIncomeTaxExpenseAccount,
  IIncomeTaxExpenseAccount,
  ILedgerAccount
>;
interface IHeaderPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
}
interface ISubAccountPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
}

export interface ITaxExpenseAccountService {
  createHeader(
    payload: IHeaderPayload,
    repoOptions: IRepoOptions
  ): Promise<TReturnType>;
  createSubAccount(payload: ISubAccountPayload): TReturnType;
}
