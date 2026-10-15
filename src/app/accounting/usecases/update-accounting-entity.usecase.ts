import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import {
  IAccountingEntityDto,
  IAccountingEntityUpdateReq,
} from '@app/accounting/dtos/accounting/accounting.dto';
import accountingEntityDtoMapper from '@app/accounting/dtos/accounting/accounting.dto.mapper';
import { accountingEntityUpdateReqSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  appContext: IAppContext;
  accountingEntityRepo: IAccountingEntityRepo;
  accountingEntityService: IAccountingEntityService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeUpdateAccountingEntityUsecase(deps: IDependencies) {
  return async (
    payload: IAccountingEntityUpdateReq
  ): Promise<IAccountingEntityDto> => {
    zodValidationRunner(accountingEntityUpdateReqSchema, payload);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const transaction = await deps.repoService.createTransaction();

    try {
      const repoOptions = { correlationId, tx: transaction.context };
      // Serialize entity edits with journal/account creation so the eligibility
      // check and all functional balance denominations remain valid through commit.
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

      const updateInput = {
        name: payload.name,
        type: payload.entityType,
        functionalCurrencyCode: payload.functionalCurrencyCode,
      };

      const {
        accountingEntity: [entity, events, audit],
        updatedBalances,
      } = await deps.accountingEntityService.update(
        current,
        updateInput,
        repoOptions
      );

      if (!audit) {
        await transaction.commit();
        deps.appContext.set({ accountingEntity: entity });

        return accountingEntityDtoMapper.toDto(entity);
      }

      const history = historyValue.make(audit, actor.id, correlationId);

      // Persist the entity, audit and prepared balance transitions atomically.
      await deps.accountingEntityRepo.update(entity, {
        ...repoOptions,
        history,
      });

      for (const balance of updatedBalances) {
        await deps.ledgerAccountBalanceRepo.update(balance, {
          ...repoOptions,
          expectedVersion: balance.version - 1,
        });
      }
      await transaction.commit();

      deps.appContext.set({ accountingEntity: entity });

      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId })
      );

      return accountingEntityDtoMapper.toDto(entity);
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
