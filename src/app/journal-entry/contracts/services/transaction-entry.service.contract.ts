import { IReadRepoOptions } from '@shared/types/repo.types';

import { TAuditedJournalEntry } from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntryMakePayload } from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLineInput } from '@domain/journal-entry/types/journal-line.types';

export default interface ITransactionEntryAppService {
  create(
    source: IJournalLineInput,
    destinations: IJournalLineInput[],
    header: Omit<IJournalEntryMakePayload, 'lines'>,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;
}
