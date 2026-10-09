import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import appError from '@shared/values/errors/app.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import { ICounterpartyDeletionEligibilityDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';

interface IDependencies {
  appContext: IAppContext;
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
