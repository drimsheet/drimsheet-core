/**
 * SUMMARY
 * Checks whether a counterparty in the selected accounting entity has
 * transaction references. Returns canDelete as true when no references are
 * found, or false otherwise; rejects a missing counterparty. This read-only
 * result describes current eligibility and does not reserve the counterparty
 * for deletion.
 *
 * WHEN TO USE
 * Use to decide whether to offer deletion or archival in the interface. Invoke
 * delete-counterparty to perform deletion with fresh eligibility checks.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import appError from '@shared/values/errors/app.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { ICounterpartyDeletionEligibilityDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
}

export default function makeGetCounterpartyDeletionEligibilityUsecase(
  deps: IDependencies
) {
  return async (id: string): Promise<ICounterpartyDeletionEligibilityDto> => {
    stringUtils.validateUUID(id, counterpartyError.InvalidCounterpartyId);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const counterpartyId = id as TEntityId;
    const repoOptions = { correlationId };

    const counterparty = await deps.counterpartyRepo.findById(
      counterpartyId,
      accountingEntity.id,
      repoOptions
    );

    if (!counterparty) {
      throw new appError.ResourceNotFound({ id });
    }

    const hasTransactionReferences =
      await deps.journalEntryQueryRepo.existsByCounterpartyId(
        counterpartyId,
        accountingEntity.id,
        repoOptions
      );

    return { canDelete: !hasTransactionReferences };
  };
}
