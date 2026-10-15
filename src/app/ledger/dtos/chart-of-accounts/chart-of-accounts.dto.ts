import { ULedgerType } from '@domain/ledger/types/ledger.types';

import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

export interface IGetChartOfAccountsQuery {
  class: ULedgerType;
  /** Omit accounts without a controlAccountId, retaining their descendants. Defaults to false. */
  omitHeaderAccounts?: boolean;
  /** Case-insensitive partial name search. Returns topmost matches with all descendants. Empty search returns the full tree. Omitted headers cannot match. */
  search?: string;
}

export interface IChartOfAccountsNodeDto extends ILedgerAccountDto {
  children: IChartOfAccountsNodeDto[];
}
