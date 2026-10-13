import { eq } from 'drizzle-orm';

import ILedgerAccountHistoryRepo from '@domain/ledger/repos/ledger-account-history.repo';

import { ledgerAccountHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountHistoryMapper from '@infra/persistence/repos/ledger/mappers/ledger-account-history.mapper';

const ledgerAccountHistoryRepo: ILedgerAccountHistoryRepo = {
  deleteByAccountId: async (id, options) => {
    await getDbQuery(options)
      .delete(ledgerAccountHistoryInAudit)
      .where(eq(ledgerAccountHistoryInAudit.ledgerAccountId, id));
  },

  save: async (histories, options) => {
    const values = Array.isArray(histories) ? histories : [histories];
    await getDbQuery(options)
      .insert(ledgerAccountHistoryInAudit)
      .values(values.map(ledgerAccountHistoryMapper.toRepo));
  },
};

export default ledgerAccountHistoryRepo;
