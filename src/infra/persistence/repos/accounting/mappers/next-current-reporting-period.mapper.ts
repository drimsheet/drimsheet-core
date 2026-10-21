import { TEntityId } from '@shared/types/uuid';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

interface INextCurrentReportingPeriodModel {
  reportingContextId: string;
  fiscalYearId: string;
  accountingEntityId: string;
  currentPeriodId: string;
  nextPeriodId: string;
}

const nextCurrentReportingPeriodMapper = {
  toDetails(
    period: INextCurrentReportingPeriodModel
  ): INextCurrentReportingPeriodDto {
    return {
      reportingContextId: period.reportingContextId as TEntityId,
      fiscalYearId: period.fiscalYearId as TEntityId,
      accountingEntityId: period.accountingEntityId as TEntityId,
      currentPeriodId: period.currentPeriodId as TEntityId,
      nextPeriodId: period.nextPeriodId as TEntityId,
    };
  },
};

export default nextCurrentReportingPeriodMapper;
