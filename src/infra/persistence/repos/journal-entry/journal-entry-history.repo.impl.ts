import { eq } from 'drizzle-orm';

import IJournalEntryHistoryRepo from '@domain/journal-entry/repos/journal-entry-history.repo';

import { journalEntryHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import journalEntryHistoryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-history.mapper';

const journalEntryHistoryRepo: IJournalEntryHistoryRepo = {
  create: async (header, history, options) => {
    const headersArray = Array.isArray(header) ? header : [header];
    const historiesArray = Array.isArray(history) ? history : [history];

    const values = headersArray.map((h, i) =>
      journalEntryHistoryMapper.toRepo(h, historiesArray[i])
    );

    await getDbQueryHelper(options)
      .insert(journalEntryHistoryInAudit)
      .values(values);
  },

  deleteByJournalEntryId: async (journalEntryId, options) => {
    await getDbQueryHelper(options)
      .delete(journalEntryHistoryInAudit)
      .where(eq(journalEntryHistoryInAudit.journalEntryId, journalEntryId));
  },
};

export default journalEntryHistoryRepo;
