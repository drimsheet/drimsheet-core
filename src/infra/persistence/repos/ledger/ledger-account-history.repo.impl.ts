import { eq } from 'drizzle-orm';

import ILedgerAccountHistoryRepo from '@domain/ledger/repos/ledger-account-history.repo';

import { ledgerAccountHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import ledgerAccountHistoryMapper from '@infra/persistence/repos/ledger/mappers/ledger-account-history.mapper';

const ledgerAccountHistoryRepo: ILedgerAccountHistoryRepo = {
  deleteByAccountId: async (id, options) => {
    await getDbQueryHelper(options)
      .delete(ledgerAccountHistoryInAudit)
      .where(eq(ledgerAccountHistoryInAudit.ledgerAccountId, id));
  },

  save: async (histories, options) => {
    const values = Array.isArray(histories) ? histories : [histories];
    await getDbQueryHelper(options)
      .insert(ledgerAccountHistoryInAudit)
      .values(values.map(ledgerAccountHistoryMapper.toRepo));
  },
};

export default ledgerAccountHistoryRepo;
