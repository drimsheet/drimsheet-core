import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';

import { ledgerAccountHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountHistoryRepo from '@infra/persistence/repos/ledger/ledger-account-history.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('ledgerAccountHistoryRepo.deleteByAccountId', () => {
  it('removes only the deleted account’s history using the supplied transaction', async () => {
    const id = generateUUID();
    const options = { correlationId: 'delete', tx: {} };
    const where = jest.fn().mockResolvedValue(undefined);
    const deleteQuery = jest.fn().mockReturnValue({ where });
    jest.mocked(getDbQuery).mockReturnValue({ delete: deleteQuery } as never);
    await ledgerAccountHistoryRepo.deleteByAccountId(id, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(deleteQuery).toHaveBeenCalledWith(ledgerAccountHistoryInAudit);
    const predicate = new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(predicate.sql).toContain('"ledger_account_id" = $1');
    expect(predicate.params).toEqual([id]);
  });
});
