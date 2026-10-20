import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';

export default interface IExchangeRateProvider {
  /** Fetch observations within the inclusive date range; reject provider failures without retrying. */
  fetch(startDate: Date, endDate: Date): Promise<IExchangeRateDto[]>;
}
