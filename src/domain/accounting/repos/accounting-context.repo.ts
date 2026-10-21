import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingContextHistory } from '@domain/accounting/types/accounting-context-audit.types';
import { IAccountingContext } from '@domain/accounting/types/context.types';

export default interface IAccountingContextRepo {
  /** Includes both open and closed contexts (ACC-AC-005). */
  existsByFiscalYear(
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  update(
    context: IAccountingContext,
    options: IWriteRepoOptions<IAccountingContextHistory>
  ): Promise<void>;

  /** Returns the fiscal year's context, including closed contexts. */
  findByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingContext | null>;

  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingContext | null>;

  /** Removes setup records for an unused entity; the caller holds its update lock. */
  deleteByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IWriteRepoOptions
  ): Promise<void>;

  create(
    payload: IAccountingContext,
    options: IWriteRepoOptions<IAccountingContextHistory>
  ): Promise<void>;
}
