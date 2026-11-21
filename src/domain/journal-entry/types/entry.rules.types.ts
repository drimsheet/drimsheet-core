import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType } from '@domain/ledger/types/ledger.types';

export interface IJournalEntryRulePermits {
  permittedTypes: Set<ULedgerType> | '*';
  permittedSubTypes: Set<ULedgerAccountSubType> | '*';
  permittedBehaviors: Set<ULedgerAccountBehavior> | '*';
}

export interface IJournalEntryRule extends Readonly<{
  source: Readonly<IJournalEntryRulePermits>;
  destination: Readonly<IJournalEntryRulePermits>;
}> {}
