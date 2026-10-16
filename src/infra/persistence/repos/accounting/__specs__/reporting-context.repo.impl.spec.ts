import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { reportingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import repo from '@infra/persistence/repos/accounting/reporting-context.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('reporting-context setup deletion', () => {
  it('deletes only the selected entity setup using the caller transaction', async () => {
    const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
    const options = { correlationId: 'remove', tx: {} };
    const where = jest.fn().mockResolvedValue(undefined);
    const query = { delete: jest.fn().mockReturnValue({ where }) };
    jest.mocked(getDbQuery).mockReturnValue(query as never);
    await repo.deleteByAccountingEntityId(id, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.delete).toHaveBeenCalledWith(reportingContextsInCore);
    expect(where).toHaveBeenCalledWith(
      eq(reportingContextsInCore.accountingEntityId, id)
    );
  });
});
