/**
 * SUMMARY
 * Archives the selected accounting entity while retaining its accounting
 * records. Saves archival and clears saved entity selections together, then
 * clears the current selection and publishes events. An already archived entity
 * only clears the current selection. Returns no value.
 *
 * WHEN TO USE
 * Use when the entity should leave active use without deleting its history.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/archive-accounting-entity.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  userPreferencesRepo: IUserPreferencesRepo;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeArchiveAccountingEntityUsecase(
  deps: IDependencies
) {
  return async (): Promise<void> => {
    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);

    const transaction = await deps.repoService.createTransaction();
    try {
      const repoOptions = { correlationId, tx: transaction.context };
      // Serialize archival with entity edits and deletion, using fresh state for the audit.
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

      const [entity, events, audit] = accountingEntityEntity.archive(current);
      if (!audit) {
        await transaction.commit();
        deps.appContext.set({ accountingEntity: undefined });
        return;
      }
      const history = historyValue.make(audit, actor.id, correlationId);

      // Retain every accounting record and commit archival with selection cleanup.
      await deps.accountingEntityRepo.update(entity, {
        ...repoOptions,
        history,
      });
      await deps.userPreferencesRepo.clearAccountingEntity(
        current.id,
        repoOptions
      );
      await transaction.commit();

      deps.appContext.set({ accountingEntity: undefined });

      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
