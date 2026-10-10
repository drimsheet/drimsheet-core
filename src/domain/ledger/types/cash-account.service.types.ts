import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ICurrency } from '@domain/money/types/currency.types';

import {
  IBankAccount,
  IBankDetails,
  ICashAndCashEquivalentAccount,
  IPettyCashAccount,
} from './asset-account.types';
import { ILedgerAccountAudit } from './ledger-account-audit.types';
import { ILedgerAccount, ULedgerAccountCreationStatus } from './ledger.types';

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
  status?: ULedgerAccountCreationStatus;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  controlAccountId?: TEntityId;
}

interface IMakeBankPayload {
  name: string;
  currency: ICurrency;
  isControlAccount: boolean;
  status?: ULedgerAccountCreationStatus;
  createdBy: TEntityId;
  accountingEntity: IAccountingEntity;
  controlAccountId?: TEntityId;
  openingBalanceDate?: Date;
  bankDetails: IBankDetails;
}

interface IUpdateCashAccountPayload {
  name?: string;
  openingBalanceDate?: Date;
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

  updatePettyCashSubAccount(
    account: ILedgerAccount,
    payload: IUpdateCashAccountPayload
  ): [
    Readonly<IPettyCashAccount>,
    IEvent<ILedgerAccount>[],
    ILedgerAccountAudit | null,
  ];

  /** Validates normalized bank details and uniqueness; returns one audited update without writes. */
  updateBankSubAccount(
    account: ILedgerAccount,
    payload: IUpdateCashAccountPayload & {
      bankDetails?: Omit<IBankDetails, 'countryCode'>;
    },
    repoOptions: IReadRepoOptions
  ): Promise<
    [
      Readonly<IBankAccount>,
      IEvent<ILedgerAccount>[],
      ILedgerAccountAudit | null,
    ]
  >;

  /** Creates a complete account under caller-owned allocation/parent locks; never persists. */
  createBankSubAccount(
    payload: IMakeBankPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TReturnType>;
}
