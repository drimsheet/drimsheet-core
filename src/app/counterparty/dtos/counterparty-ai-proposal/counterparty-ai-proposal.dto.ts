import {
  ICounterpartyRoleDetails,
  UCounterpartyRole,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

import { TAiAssessmentValue } from '@app/ai/types/ai-assessment';

export interface ICounterpartyAiProposal {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<UCounterpartyType>;
  roles: TAiAssessmentValue<UCounterpartyRole[]>;
  roleDetails: ICounterpartyRoleDetails;
}
