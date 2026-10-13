import { IOpeningBalanceDto } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';

export interface ILedgerAccountOpeningBalanceDto {
  openingBalance: IOpeningBalanceDto | null;
}
