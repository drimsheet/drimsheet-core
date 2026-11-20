import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType, UNormalBalance } from '@domain/ledger/types/ledger.types';

import { TAiAssessmentValue } from '@app/ai/types/ai-assessment';

export interface ILedgerAccountAiProposal {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<ULedgerType>;
  normalBalance: TAiAssessmentValue<UNormalBalance>;
  subType: TAiAssessmentValue<ULedgerAccountSubType>;
  behavior: TAiAssessmentValue<ULedgerAccountBehavior>;
}
