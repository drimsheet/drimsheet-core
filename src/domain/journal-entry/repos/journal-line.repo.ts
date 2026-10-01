import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IJournalLineHistory } from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

export default interface IJournalLineRepo {
  create(
    payload: IJournalLine | IJournalLine[],
    options: IWriteRepoOptions<IJournalLineHistory | IJournalLineHistory[]> & {
      accountingEntityId: TEntityId;
    }
  ): Promise<void>;

  update(
    payload: IJournalLine,
    options: IVersionedRepoWriteOptions<IJournalLineHistory> & {
      accountingEntityId: TEntityId;
    }
  ): Promise<void>;

  delete(ids: TEntityId[], options: IWriteRepoOptions): Promise<void>;

  /** Retrieves tenant-scoped references across every journal status. */
  findAllByCounterpartyId(
    counterpartyId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalLine[]>;

  findAllByAccountId(
    accountId: string,
    options: IPaginatedReadRepoOptions
  ): Promise<IPaginatedResponse<IJournalLine>>;
}
