import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import {
  ICounterpartyRoleDetails,
  UCounterpartyRole,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';
import { UJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { UJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType, UNormalBalance } from '@domain/ledger/types/ledger.types';

import {
  IAiAssessmentDto,
  TAiAssessmentValue,
} from '@app/ai/dtos/assessment/assessment.dto';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IJournalEntryExtractionDto {
  accountId: string;
  sourceType?: UJournalEntrySourceType;
  actorId: string;
  accountingEntityId: string;
  file: IFileAttachment;
}

interface ILedgerAccountResponse {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<ULedgerType>;
  normalBalance: TAiAssessmentValue<UNormalBalance>;
  subType: TAiAssessmentValue<ULedgerAccountSubType>;
  behavior: TAiAssessmentValue<ULedgerAccountBehavior>;
}

interface ICounterpartyResponse {
  temporaryId: string;
  name: TAiAssessmentValue<string>;
  type: TAiAssessmentValue<UCounterpartyType>;
  roles: TAiAssessmentValue<UCounterpartyRole[]>;
  roleDetails: ICounterpartyRoleDetails;
}

interface IEntryResponse {
  temporaryId: string;
  sourceType: TAiAssessmentValue<UJournalEntrySourceType>;
  memo: string | null;
  effectiveDate: TAiAssessmentValue<string>;

  lines: {
    temporaryId: string;
    accountTemporaryId: TAiAssessmentValue<string>;
    sequenceOrder: number;
    amount: TAiAssessmentValue<IMoneyDto>;
    exchangeRate: TAiAssessmentValue<IExchangeRateDto | null>;
    side: TAiAssessmentValue<UJournalSide>;
    description: string | null;
    counterpartyTemporaryId: TAiAssessmentValue<string | null>;
    functionalAmount: TAiAssessmentValue<IMoneyDto>;
  }[];
}

export interface IJournalEntryExtractionAiResponse {
  ledgerAccounts: IAiAssessmentDto<ILedgerAccountResponse>[];
  counterparties: IAiAssessmentDto<ICounterpartyResponse>[];
  entries: IAiAssessmentDto<IEntryResponse>[];
}
