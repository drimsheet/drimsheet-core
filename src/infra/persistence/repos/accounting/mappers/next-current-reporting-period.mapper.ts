import { TEntityId } from '@shared/types/uuid';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

interface INextCurrentReportingPeriodModel {
  accountingEntityId: string;
  reportingIntervalId: string;
}

const nextCurrentReportingPeriodMapper = {
  fromRepo(
    period: INextCurrentReportingPeriodModel
  ): INextCurrentReportingPeriodDto {
    return {
      accountingEntityId: period.accountingEntityId as TEntityId,
      reportingIntervalId: period.reportingIntervalId as TEntityId,
    };
  },
};

export default nextCurrentReportingPeriodMapper;
