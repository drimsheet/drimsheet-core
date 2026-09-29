import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  ERevenueAccountBehavior,
  ERevenueSubType,
} from '@domain/ledger/types/revenue-account.types';

function validate(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Revenue &&
    controlAccount.subType === ERevenueSubType.UnrealizedGains &&
    controlAccount.isControlAccount &&
    controlAccount.behavior === ERevenueAccountBehavior.UnrealizedGains;

  if (!isValidControlAccount) {
    throw new ledgerAccountError.InvalidControlAccount({
      controlAccountId: controlAccount.id,
      controlAccountLedgerCode: controlAccount.code,
      type: controlAccount.type,
      subType: controlAccount.subType,
      isControlAccount: controlAccount.isControlAccount,
      accountingEntityId,
      controlAccountAccountingEntityId: controlAccount.accountingEntityId,
    });
  }
}

export default Object.freeze({ validate });
