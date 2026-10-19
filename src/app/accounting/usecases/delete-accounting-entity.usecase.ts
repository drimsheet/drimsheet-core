import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import eventValue from '@shared/values/events/event.vo';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  accountingContextRepo: IAccountingContextRepo;
  reportingContextRepo: IReportingContextRepo;
  counterpartyRepo: ICounterpartyRepo;
  userPreferencesRepo: IUserPreferencesRepo;
  accountingEntityService: IAccountingEntityService;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeDeleteAccountingEntityUsecase(deps: IDependencies) {
  return async (): Promise<void> => {
    const { accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);
    const transaction = await deps.repoService.createTransaction();

    try {
      const repoOptions = { correlationId, tx: transaction.context };
      // Preparation: the parent update lock conflicts with journal inserts'
      // foreign-key/share locks, preserving deletion eligibility through commit.
      const current = await deps.accountingEntityRepo.findById(
        accountingEntity.id,
        {
          ...repoOptions,
          lock: ERepoLock.Update,
        }
      );
      if (!current) {
        throw new accountingAppError.ActiveEntityNotFound();
      }
      const [deletedEntity, deleteEvent] =
        await deps.accountingEntityService.delete(current, repoOptions);

      // Persistence: release restrictive setup references before parent cascades.
      // These repositories leave audit history intact.
      await deps.reportingContextRepo.deleteByAccountingEntityId(
        deletedEntity.id,
        repoOptions
      );
      await deps.accountingContextRepo.deleteByAccountingEntityId(
        deletedEntity.id,
        repoOptions
      );
      await deps.counterpartyRepo.deleteByAccountingEntityId(
        deletedEntity.id,
        repoOptions
      );
      await deps.userPreferencesRepo.clearAccountingEntity(
        deletedEntity.id,
        repoOptions
      );
      await deps.accountingEntityRepo.delete(deletedEntity.id, repoOptions);

      await transaction.commit();

      deps.appContext.set({ accountingEntity: undefined });

      await deps.eventBus.publish(
        eventValue.enrich(deleteEvent, { correlationId, idempotencyKey })
      );
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
