import { TAiAssessmentValue } from '@shared/types/ai.types';

import { UJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { UJournalSide } from '@domain/journal-entry/types/journal-line.types';

import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IJournalHeaderAiProposal {
  temporaryId: string;
  sourceType: TAiAssessmentValue<UJournalEntrySourceType>;
  memo: string | null;
  effectiveDate: TAiAssessmentValue<string>;
}

export interface IJournalLineAiProposal {
  temporaryId: string;
  accountTemporaryId: TAiAssessmentValue<string>;
  sequenceOrder: number;
  amount: TAiAssessmentValue<IMoneyDto>;
  exchangeRate: TAiAssessmentValue<IExchangeRateDto | null>;
  side: TAiAssessmentValue<UJournalSide>;
  description: string | null;
  counterpartyTemporaryId: TAiAssessmentValue<string | null>;
  functionalAmount: TAiAssessmentValue<IMoneyDto>;
}

export interface IJournalEntryAiProposal extends IJournalHeaderAiProposal {
  lines: IJournalLineAiProposal[];
}
