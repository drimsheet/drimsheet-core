import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import { IAccountingEntityAudit } from '@domain/accounting/types/accounting-entity-audit.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import {
  IAccountingEntity,
  UAccountingEntityType,
} from './accounting-entity.types';
import { IAccountingContext, IReportingContext } from './context.types';
import { IFiscalYear } from './fiscal-year.types';
import {
  IAccountingPeriod,
  IReportingPeriod,
  UPeriodUnit,
} from './period.types';

export interface IAccountingEntityCreationInput {
  createdBy: TEntityId;
  name: string;
  type: UAccountingEntityType;
  ownerId: TEntityId;
  functionalCurrencyCode: UCurrencyCode;
  reportingCurrencyCode: UCurrencyCode;
  jurisdictionCode: UJurisdictionCode;
  accountingStandardCode: UAccountingStandardCode;
  fiscalYear: { startDate: Date; endDate: Date };
  accountingPeriod: { unit: UPeriodUnit; count: number };
  reportingPeriod: { unit: UPeriodUnit; count: number };
}

export interface IAccountingEntityCreationResult {
  accountingEntity: TAuditedEntity<
    IAccountingEntity,
    IAccountingEntity,
    IAccountingEntity
  >;
  fiscalYear: TAuditedEntity<IFiscalYear, IFiscalYear, IFiscalYear>;
  accountingPeriods: TAuditedEntity<
    IAccountingPeriod,
    IAccountingPeriod,
    IAccountingPeriod
  >[];
  accountingContext: TAuditedEntity<
    IAccountingContext,
    IAccountingContext,
    IAccountingContext
  >;
  reportingPeriods: TAuditedEntity<
    IReportingPeriod,
    IReportingPeriod,
    IReportingPeriod
  >[];
  reportingContext: TAuditedEntity<
    IReportingContext,
    IReportingContext,
    IReportingContext
  >;
}

export default interface IAccountingEntityService {
  create(
    input: IAccountingEntityCreationInput,
    repoOptions: IReadRepoOptions
  ): Promise<IAccountingEntityCreationResult>;

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
