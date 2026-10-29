/**
 * SUMMARY
 * Lists journals within the selected accounting entity using status, account,
 * counterparty, dates, currency, account type, search, ordering, and pagination.
 * Returns journal details with account and counterparty information plus pagination metadata; a
 * result page may be empty.
 *
 * WHEN TO USE
 * Use to browse and filter the entity's journal activity. Use get-journal-entry
 * for a single entry lookup.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import dateRangeValue from '@shared/values/date-range/date-range.vo';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryQueryRepo, {
  IFindAllJournalEntriesOptions,
} from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import {
  IGetJournalEntriesQuery,
  IJournalEntryListDto,
} from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { getJournalEntriesQueryValidationSchema } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
}

export default function makeGetJournalEntriesUsecase(deps: IDependencies) {
  return async (
    query: IGetJournalEntriesQuery
  ): Promise<IPaginatedResponse<IJournalEntryListDto>> => {
    zodValidationRunner(getJournalEntriesQueryValidationSchema, query);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions: IFindAllJournalEntriesOptions = {
      status: query.status,
      sourceType: query.sourceType,
      createdAtRange: dateRangeValue.make({
        from: query.createdAtFrom ? new Date(query.createdAtFrom) : undefined,
        to: query.createdAtTo ? new Date(query.createdAtTo) : undefined,
      }),
      effectiveDateRange: dateRangeValue.make({
        from: query.effectiveDateFrom
          ? new Date(query.effectiveDateFrom)
          : undefined,
        to: query.effectiveDateTo ? new Date(query.effectiveDateTo) : undefined,
      }),
      updatedAtRange: dateRangeValue.make({
        from: query.updatedAtFrom ? new Date(query.updatedAtFrom) : undefined,
        to: query.updatedAtTo ? new Date(query.updatedAtTo) : undefined,
      }),
      currencyCode: query.currencyCode,
      accountType: query.accountType,
      accountId: query.accountId as TEntityId | undefined,
      counterpartyId: query.counterpartyId as TEntityId | undefined,
      limit: query.limit,
      offset: paginationValue.pageToOffset(query.page, query.limit),
      orderBy: query.orderBy,
      search: query.search,
      sortDirection: query.sortDirection,
      correlationId,
    };

    const journalEntries = await deps.journalEntryQueryRepo.findAll(
      accountingEntity.id,
      repoOptions
    );

    return {
      data: journalEntries.data.map(journalEntryDtoMapper.toListDto),
      meta: journalEntries.meta,
    };
  };
}
