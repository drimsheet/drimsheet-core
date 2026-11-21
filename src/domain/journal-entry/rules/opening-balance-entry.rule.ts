import { IJournalEntryRule } from '@domain/journal-entry/types/entry.rules.types';
import { ELedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.types';
import { ELedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';

const openingBalanceEntryRule: IJournalEntryRule = {
  source: {
    permittedTypes: '*',
    permittedSubTypes: '*',
    permittedBehaviors: '*',
  },
  destination: {
    permittedTypes: new Set([ELedgerType.Equity]),
    permittedSubTypes: new Set([ELedgerAccountSubType.OpeningBalance]),
    permittedBehaviors: new Set([ELedgerAccountBehavior.OpeningBalanceEquity]),
  },
};

export default openingBalanceEntryRule;
