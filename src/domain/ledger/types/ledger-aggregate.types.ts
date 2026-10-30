import { EAssetSubType, UAssetSubType } from './asset-account.types';
import { EEquitySubType, UEquitySubType } from './equity-account.types';
import { EExpenseSubType, UExpenseSubType } from './expense-account.types';
import {
  ELiabilitySubType,
  ULiabilitySubType,
} from './liability-account.types';
import { ERevenueSubType, URevenueSubType } from './revenue-account.types';

export const ELedgerAccountSubType = {
  ...EAssetSubType,
  ...ELiabilitySubType,
  ...EEquitySubType,
  ...ERevenueSubType,
  ...EExpenseSubType,
} as const;

export type ULedgerAccountSubType =
  | UAssetSubType
  | ULiabilitySubType
  | UEquitySubType
  | URevenueSubType
  | UExpenseSubType;
