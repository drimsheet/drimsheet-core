import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { IDirectCostsAccount } from './expense-account.types';
import { TDirectCostsLedgerCode } from './ledger-code.types';
import { ILedgerAccount } from './ledger.types';

type TReturnType = TAuditedEntity<
  IDirectCostsAccount,
  IDirectCostsAccount,
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
  behavior: IDirectCostsAccount['behavior'];
  isControlAccount: boolean;
  controlAccountCode: TDirectCostsLedgerCode;
}

export interface IDirectCostsAccountService {
  createHeader(
    payload: IHeaderPayload,
    repoOptions: IRepoOptions
  ): Promise<TReturnType>;
  createSubAccount(
    payload: ISubAccountPayload,
    repoOptions: IRepoOptions
  ): Promise<TReturnType>;
}
