import { IJournalEntryRulePermits } from '@domain/journal-entry/types/entry.rules.types';
import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
export default function journalEntryRuleValidator(
  account: ILedgerAccount,
  permits: IJournalEntryRulePermits
) {
  const isWrongType =
    permits.permittedTypes !== '*' && !permits.permittedTypes.has(account.type);

  if (isWrongType) return false;

  const isWrongSubType =
    permits.permittedSubTypes !== '*' &&
    !permits.permittedSubTypes.has(account.subType as ULedgerAccountSubType);

  if (isWrongSubType) {
    return false;
  }

  const isWrongBehavior =
    permits.permittedBehaviors !== '*' &&
    !permits.permittedBehaviors.has(account.behavior as ULedgerAccountBehavior);

  if (isWrongBehavior) {
    return false;
  }

  return true;
}
