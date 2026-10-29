/**
 * SUMMARY
 * Lists active accounting entities belonging to the signed-in user. Returns an
 * array, which may be empty; archived entities are excluded.
 *
 * WHEN TO USE
 * Use to populate entity selection.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
}

export default function makeGetUserAccountingEntitiesUseCase(
  deps: IDependencies
) {
  return async () => {
    const { user, correlationId } = deps.appContext.get(['user']);

    const accountingEntities = await deps.accountingEntityRepo.findByUserId(
      user.id,
      {
        correlationId,
        status: EAccountingEntityStatus.Active,
      }
    );

    return accountingEntities;
  };
}
