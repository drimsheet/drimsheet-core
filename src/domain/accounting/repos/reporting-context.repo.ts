import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingContext } from '@domain/accounting/types/context.types';
import { IReportingContextHistory } from '@domain/accounting/types/reporting-context-audit.types';

export default interface IReportingContextRepo {
  update(
    context: IReportingContext,
    options: IWriteRepoOptions<IReportingContextHistory>
  ): Promise<void>;

  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingContext | null>;

  /** Removes setup records for an unused entity; the caller holds its update lock. */
  deleteByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IWriteRepoOptions
  ): Promise<void>;

  create(
    payload: IReportingContext,
    options: IWriteRepoOptions<IReportingContextHistory>
  ): Promise<void>;
}
