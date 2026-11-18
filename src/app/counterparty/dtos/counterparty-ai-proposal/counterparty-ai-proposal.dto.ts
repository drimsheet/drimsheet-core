import { TAiAssessmentValue } from '@shared/types/ai.types';

import {
  ICounterpartyRoleDetails,
  UCounterpartyRole,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

export interface ICounterpartyAiProposal {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<UCounterpartyType>;
  roles: TAiAssessmentValue<UCounterpartyRole[]>;
  roleDetails: ICounterpartyRoleDetails;
}
