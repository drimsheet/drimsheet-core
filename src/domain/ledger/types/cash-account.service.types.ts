import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICurrency } from '@domain/money/types/currency.types';

import {
  IBankDetails,
  ICashAndCashEquivalentAccount,
} from './asset-account.types';
import { ILedgerAccount } from './ledger.types';

interface IMakeHeaderPayload {
  name: string;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
}

interface IMakePettyCashPayload {
  openingBalanceDate?: Date;
  name: string;
  currency: ICurrency;
  isControlAccount: boolean;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  controlAccountId?: TEntityId;
}

interface IMakeBankPayload {
  name: string;
  currency: ICurrency;
  isControlAccount: boolean;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  controlAccountId?: TEntityId;
  openingBalanceDate?: Date;
  bankDetails: IBankDetails;
}

type TReturnType = TAuditedEntity<
  ICashAndCashEquivalentAccount,
  ICashAndCashEquivalentAccount,
  ILedgerAccount
>;

export default interface ICashAccountService {
  createHeader(
    payload: IMakeHeaderPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TReturnType>;

  createPettyCashSubAccount(
    payload: IMakePettyCashPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TReturnType>;

  /** Prepares a complete account under caller-owned allocation/parent locks; never persists. */
  createBankSubAccount(
    payload: IMakeBankPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TReturnType>;
}
