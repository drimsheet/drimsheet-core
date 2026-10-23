import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IAssetLiabilityAccountBalance {
  accountId: string;
  accountName: string;
  code: string;
  type: 'asset' | 'liability';
  subType: string;
  status: ULedgerAccountStatus;
  isControlAccount: boolean;
  controlAccountId: string | null;
  functionalBalance: bigint | null;
}

/**
 * Reads asset/liability roots for totals and posting accounts for rows in one
 * snapshot. Includes suspense, zero balances and every account status. Stored
 * balances are eventually consistent. Returns code/ID order before filtering
 * and pagination; missing balances remain null. Does not read journals.
 */
export default interface IAssetLiabilityAccountParticipationQueryRepo {
  findAll(
    accountingEntityId: TEntityId,
    currencyCode: UCurrencyCode,
    options: IReadRepoOptions
  ): Promise<IAssetLiabilityAccountBalance[]>;
}
