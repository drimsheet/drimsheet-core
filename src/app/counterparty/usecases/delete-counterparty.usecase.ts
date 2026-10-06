import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import counterpartyServiceValidation from '@domain/counterparty/services/validations/counterparty.validation';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import counterpartyMutationPolicy from '@app/counterparty/policies/counterparty-mutation.policy';

interface IDependencies {
  repoService: IRepoService;
  appContext: IAppContext;
  journalLineRepo: IJournalLineRepo;
  counterpartyRepo: ICounterpartyRepo;
}

export default function makeDeleteCounterpartyUsecase(
  deps: Readonly<IDependencies>
) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, counterpartyError.InvalidCounterpartyId);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const transaction = await deps.repoService.createTransaction();

    try {
      // Preparation: hold the parent lock through the usage check and deletion
      // so concurrent foreign-key association writes cannot race eligibility.
      const readOptions = { correlationId, tx: transaction.context };
      const existing = await deps.counterpartyRepo.findById(
        id as TEntityId,
        accountingEntity.id,
        { ...readOptions, lock: ERepoLock.Update }
      );

      const current = counterpartyMutationPolicy.validate({
        id,
        counterparty: existing,
        accountingEntityId: accountingEntity.id,
      });

      await counterpartyServiceValidation.validateDeletionAllowed(
        deps.journalLineRepo,
        current.id,
        current.accountingEntityId,
        readOptions
      );

      // Persistence: delete only the eligible parent, retaining all audit records.
      await deps.counterpartyRepo.delete(current.id, accountingEntity.id, {
        ...readOptions,
        expectedVersion: current.version,
      });

      await transaction.commit();
    } catch (error) {
      return transaction.handleError(error);
    }
  };
}
