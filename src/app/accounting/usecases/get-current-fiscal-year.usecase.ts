/**
 * SUMMARY
 * Retrieves the fiscal year containing today UTC for the selected entity.
 * Rejects an absent year; reports overlapping matches and returns the first
 * by start date then ID. Reads all statuses without changing stored state.
 *
 * WHEN TO USE
 * Use to resolve the current annual accounting cycle.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IReporter from '@shared/contracts/reporter.contract';
import dateUtils from '@shared/utils/date';

import periodError from '@domain/accounting/errors/period.error';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  reporter: IReporter;
}

export default function makeGetCurrentFiscalYearUsecase(deps: IDependencies) {
  return async (): Promise<IFiscalYear> => {
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const today = dateUtils.toUtcStartOfDay(dateUtils.now());
    const years = await deps.fiscalYearRepo.findByDate(
      accountingEntity.id,
      today,
      { correlationId }
    );
    const [year] = years;

    if (!year) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    if (years.length > 1) {
      deps.reporter.report(
        'accounting.fiscal_year.overlap_detected',
        new periodError.OverlappingFiscalYears({
          accountingEntityId: accountingEntity.id,
          date: today,
          fiscalYearIds: years.map((match) => match.id),
        }),
        { operation: 'getCurrentFiscalYear' }
      );
    }

    return year;
  };
}
