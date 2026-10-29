/**
 * SUMMARY
 * Lists fiscal years configured for the selected accounting entity. Returns an
 * array, which may be empty.
 *
 * WHEN TO USE
 * Use to populate year selection or inspect the entity's configured years.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
}

export default function makeGetFiscalYearsUsecase(deps: IDependencies) {
  return async (): Promise<IFiscalYear[]> => {
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    return deps.fiscalYearRepo.findByAccountingEntityId(accountingEntity.id, {
      correlationId,
    });
  };
}
