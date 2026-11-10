/**
 * Edits a draft opening balance in the selected accounting entity. Saves the
 * journal, lines, attachments, and audit history atomically, then publishes
 * events. The posting action checks the proposed date.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IUpdateDraftOpeningBalanceReq } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';
import { updateDraftOpeningBalanceReqValidation } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalLineChangesHelper from '@app/journal-entry/usecases/helpers/get-journal-line-changes.helper';
import resolveJournalAttachmentsHelper from '@app/journal-entry/usecases/helpers/resolve-journal-attachments.helper';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  fileManagementAppService: IFileManagementAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  journalEntryRepo: IJournalEntryRepo;
  openingBalanceEntryService: IOpeningBalanceEntryService;
}

export default function makeUpdateDraftOpeningBalanceUsecase(
  deps: IDependencies
) {
  return async (
    id: string,
    payload: IUpdateDraftOpeningBalanceReq
  ): Promise<IJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(updateDraftOpeningBalanceReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey, user } =
      deps.appContext.get(['actor', 'accountingEntity', 'user']);
    const repoOptions = { correlationId, idempotencyKey };
    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );
    const entry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const attachments = await resolveJournalAttachmentsHelper(
      deps.fileManagementAppService,
      user.id,
      entry.attachments,
      payload.attachments
    );
    const amount = payload.amount && moneyMapper.fromDto(payload.amount);
    const exchangeRate =
      payload.exchangeRate && exchangeRateValue.make(payload.exchangeRate);

    const [updatedEntry, events, audit] =
      await deps.openingBalanceEntryService.updateDraft(
        {
          entry,
          createdBy: actor.id,
          amount,
          effectiveDate: payload.effectiveDate,
          exchangeRate,
          memo: payload.memo,
          attachments,
        },
        repoOptions
      );

    if (audit) {
      await deps.journalEntryPersistenceAppService.update(
        {
          entry: updatedEntry,
          expectedVersion: entry.version,
          headerHistory: historyValue.make(
            audit.header,
            actor.id,
            correlationId
          ),
          lineHistories: audit.lines.map((lineAudit) =>
            historyValue.make(lineAudit, actor.id, correlationId)
          ),
          ...getJournalLineChangesHelper(entry.lines, updatedEntry.lines),
        },
        repoOptions
      );
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
    }

    return journalEntryDtoMapper.toDto(updatedEntry);
  };
}
