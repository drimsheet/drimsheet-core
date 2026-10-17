import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
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
