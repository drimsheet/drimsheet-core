import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

interface IDependencies {
  usecase: (accountingPeriod: INextCurrentAccountingPeriodDto) => Promise<void>;
}

export default function makeSetCurrentAccountingPeriodWorker(
  deps: IDependencies
) {
  return async (payload: INextCurrentAccountingPeriodDto): Promise<void> => {
    await deps.usecase(payload);
  };
}
