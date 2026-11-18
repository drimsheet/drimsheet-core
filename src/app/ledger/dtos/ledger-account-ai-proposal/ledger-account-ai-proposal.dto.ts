import { TAiAssessmentValue } from '@shared/types/ai.types';

import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType, UNormalBalance } from '@domain/ledger/types/ledger.types';

export interface ILedgerAccountAiProposal {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<ULedgerType>;
  normalBalance: TAiAssessmentValue<UNormalBalance>;
  subType: TAiAssessmentValue<ULedgerAccountSubType>;
  behavior: TAiAssessmentValue<ULedgerAccountBehavior>;
}
