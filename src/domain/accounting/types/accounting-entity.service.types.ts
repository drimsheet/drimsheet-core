import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import { IAccountingEntityAudit } from '@domain/accounting/types/accounting-entity-audit.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import {
  IAccountingEntity,
  UAccountingEntityType,
} from './accounting-entity.types';

export interface IAccountingEntityCreationInput {
  createdBy: TEntityId;
  name: string;
  type: UAccountingEntityType;
  ownerId: TEntityId;
  functionalCurrencyCode: UCurrencyCode;
  jurisdictionCode: UJurisdictionCode;
}

export default interface IAccountingEntityService {
  /** Creates only the entity, event, and audit; never prepares a calendar or persists. */
  create(
    input: IAccountingEntityCreationInput,
    options: IReadRepoOptions
  ): Promise<
    TAuditedEntity<IAccountingEntity, IAccountingEntity, IAccountingEntity>
  >;

  /**
   * Prepares the entity transition and every balance when functional currency changes.
   * Rejects balances inconsistent with the entity's current functional currency.
   * Caller holds the accounting entity update lock through invariant reads and persistence.
   * Each returned balance advances its persisted version by one.
   */
  update(
    current: IAccountingEntity,
    changes: Partial<
      Pick<IAccountingEntity, 'name' | 'type' | 'functionalCurrencyCode'>
    >,
    repoOptions: IReadRepoOptions
  ): Promise<{
    accountingEntity: [
      IAccountingEntity,
      IEvent<IAccountingEntity>[],
      IAccountingEntityAudit | null,
    ];
    updatedBalances: ILedgerAccountBalance[];
  }>;

  /** Validates deletion and returns [entity, deletion event, null]. Caller holds the entity update lock through preparation and persistence. */
  delete(
    current: IAccountingEntity,
    repoOptions: IReadRepoOptions
  ): Promise<[IAccountingEntity, IEvent<IAccountingEntity>, null]>;

  grantUserAccess(
    accountingEntity: IAccountingEntity,
    userId: TEntityId
  ): boolean;

  validateAccess(accountingEntity: IAccountingEntity, userId: TEntityId): void;
}
