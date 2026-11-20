import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { IAgentRunContextDto } from '@app/ai/dtos/agent-run-context/agent-run-context.dto';
import { IAiAssessment } from '@app/ai/types/ai-assessment';
import { ICounterpartyAiProposal } from '@app/counterparty/dtos/counterparty-ai-proposal/counterparty-ai-proposal.dto';
import { IJournalEntryAiProposal } from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto';
import { ILedgerAccountAiProposal } from '@app/ledger/dtos/ledger-account-ai-proposal/ledger-account-ai-proposal.dto';

export interface IJournalEntriesExtractionInput {
  value: IFileAttachment | string;
}

export interface IJournalEntryExtractionDto {
  value: IFileAttachment | string;
  context: IAgentRunContextDto;
}

export interface IJournalEntryExtractionAiResponse {
  ledgerAccounts: IAiAssessment<ILedgerAccountAiProposal>[];
  counterparties: IAiAssessment<ICounterpartyAiProposal>[];
  entries: IAiAssessment<IJournalEntryAiProposal>[];
}
