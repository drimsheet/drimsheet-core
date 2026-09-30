import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICurrency } from '@domain/money/types/currency.types';

import { ILedgerAccount } from './ledger.types';
import {
  ICreditCardAccount,
  ICreditCardAccountMeta,
  IShortTermDebtAccount,
  IShortTermLoanAccount,
} from './liability-account.types';

type TReturnType = TAuditedEntity<
  IShortTermDebtAccount,
  IShortTermDebtAccount,
  ILedgerAccount
>;

type TShortTermLoanReturnType = TAuditedEntity<
  IShortTermLoanAccount,
  IShortTermLoanAccount,
  ILedgerAccount
>;

type TCreditCardReturnType = TAuditedEntity<
  ICreditCardAccount,
  ICreditCardAccount,
  ILedgerAccount
>;

interface IMakeHeaderPayload {
  name: string;
  accountingEntity: IAccountingEntity;
  createdBy: TEntityId;
}

interface ICreateCreditCardPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  currency: ICurrency;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
  meta: ICreditCardAccountMeta;
}

interface ICreateSubAccountPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  currency: ICurrency | null;
  isControlAccount: boolean;
  controlAccount: ILedgerAccount;
}

export interface IShortTermLoanAccountService {
  createHeader(
    payload: IMakeHeaderPayload,
    repoOptions: IRepoOptions
  ): Promise<TReturnType>;

  createSubAccount(payload: ICreateSubAccountPayload): TShortTermLoanReturnType;

  createCreditCardSubAccount(
    payload: ICreateCreditCardPayload
  ): TCreditCardReturnType;
}
