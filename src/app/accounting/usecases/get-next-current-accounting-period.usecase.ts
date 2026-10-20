import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export default function makeGetNextCurrentAccountingPeriodUsecase() {
  return async (): Promise<IAccountingPeriod[]> => {
    // get app context data

    //

    return await Promise.resolve([]);
  };
}
