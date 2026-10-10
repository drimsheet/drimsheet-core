import { IReadRepoOptions } from '@shared/types/repo.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

export default interface ILedgerAccountBalanceEnrichmentAppService {
  /**
   * Returns one DTO per input account in the same order. Missing balances are
   * reported and mapped as zero balances. Unexpected failures reject unchanged.
   */
  enrich(
    accounts: ILedgerAccount[],
    accountingEntity: IAccountingEntity,
    repoOptions: IReadRepoOptions
  ): Promise<ILedgerAccountDto[]>;
}
