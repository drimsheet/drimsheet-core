import { ISetCurrentAccountingPeriodJobDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

export default interface ICurrentAccountingPeriodQueue {
  add(payload: ISetCurrentAccountingPeriodJobDto): Promise<void>;
}
