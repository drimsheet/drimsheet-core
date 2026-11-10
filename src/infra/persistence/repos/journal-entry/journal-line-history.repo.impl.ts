import { eq } from 'drizzle-orm';

import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import IJournalLineHistoryRepo from '@domain/journal-entry/repos/journal-line-history.repo';

import { journalLineHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import journalLineHistoryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-line-history.mapper';

const journalLineHistoryRepo: IJournalLineHistoryRepo = {
  create: async (payload, historyPayload, accountingEntityId, options) => {
    const lines = Array.isArray(payload) ? payload : [payload];
    const histories = Array.isArray(historyPayload)
      ? historyPayload
      : [historyPayload];
    const historyByLineId = new Map(
      histories.map((history) => [history.entityId, history])
    );

    const values = lines.map((line) => {
      const history = historyByLineId.get(line.id);

      if (!history) {
        throw new journalLineError.MissingHistory({
          id: line.id,
          correlationId: options.correlationId,
        });
      }

      return journalLineHistoryMapper.toRepo(line, history, accountingEntityId);
    });

    await getDbQueryHelper(options)
      .insert(journalLineHistoryInAudit)
      .values(values);
  },

  deleteByJournalEntryId: async (journalEntryId, options) => {
    await getDbQueryHelper(options)
      .delete(journalLineHistoryInAudit)
      .where(eq(journalLineHistoryInAudit.journalEntryId, journalEntryId));
  },
};

export default journalLineHistoryRepo;
