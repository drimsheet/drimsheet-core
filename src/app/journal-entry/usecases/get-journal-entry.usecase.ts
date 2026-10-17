import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import appError from '@shared/values/errors/app.error';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import { IJournalEntryListDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
}

export default function makeGetJournalEntryUsecase(deps: IDependencies) {
  return async (id: string): Promise<IJournalEntryListDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const journalEntry = await deps.journalEntryQueryRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      { correlationId }
    );

    if (!journalEntry) {
      throw new appError.ResourceNotFound({ id });
    }

    return journalEntryDtoMapper.toListDto(journalEntry);
  };
}
