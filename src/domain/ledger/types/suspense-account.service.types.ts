import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { ICurrency } from '@domain/money/types/currency.types';

import { IAssetSuspenseAccount } from './asset-account.types';
import { ILedgerAccount } from './ledger.types';
import { ILiabilitySuspenseAccount } from './liability-account.types';

interface IMakePayload {
  name: string;
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  currency: ICurrency;
}

/**
 * Prepares one account per entity/type/currency, including archived/deleted rows.
 * Writers must hold the entity row lock through persistence and pass that
 * transaction to the reads; a duplicate precheck alone does not serialize codes.
 */
export interface ISuspenseAccountService {
  createAssetSuspense(
    payload: IMakePayload,
    repoOptions: IRepoOptions
  ): Promise<
    TAuditedEntity<IAssetSuspenseAccount, IAssetSuspenseAccount, ILedgerAccount>
  >;

  createLiabilitySuspense(
    payload: IMakePayload,
    repoOptions: IRepoOptions
  ): Promise<
    TAuditedEntity<
      ILiabilitySuspenseAccount,
      ILiabilitySuspenseAccount,
      ILedgerAccount
    >
  >;
}
