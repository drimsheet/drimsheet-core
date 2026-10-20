import { IAccountingPeriod } from '@domain/accounting/types/period.types';

/** I/O scaffold only; the transition is not implemented or wired into the runtime. */
export default function makeSetCurrentAccountingPeriodUsecase() {
  return async (_accountingPeriod: IAccountingPeriod): Promise<void> => {
    // TODO: Execute the workflow that sets the next accounting period.
  };
}
