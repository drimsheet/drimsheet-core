import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';

import { mockReportingContextHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import { reportingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';
import repo from '@infra/persistence/repos/accounting/reporting-context.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

jest.mock(
  '@infra/persistence/repos/accounting/reporting-context-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockReportingContextHistoryRepo,
  })
);

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

describe('reporting-context atomic creation', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const [context, , audit] = reportingContextEntity.make({
    createdBy: id,
    accountingEntityId: id,
    accountingContextId: id,
    currentReportingPeriodId: id,
    reportingCurrencyCode: 'USD',
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  });
  const history = historyValue.make(audit, id, 'context');
  const options = { correlationId: 'context', history };
  beforeEach(() => jest.resetAllMocks());

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const values = jest.fn(async (row: unknown) => {
      staged.push(row);
    });
    const insert = jest.fn().mockReturnValue({ values });
    const innerTx = { insert };
    const transaction = jest.fn(
      async (write: (db: typeof innerTx) => Promise<void>) => {
        try {
          await write(innerTx);
          committed.push(...staged);
        } finally {
          staged.length = 0;
        }
      }
    );
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ transaction } as unknown as ReturnType<
        typeof getDbQuery
      >);
    return { committed, staged, values, insert, innerTx };
  }

  it('saves the context and history in the same transaction', async () => {
    const fake = fakeTransaction();
    await repo.create(context, options);
    expect(fake.committed).toEqual([reportingContextMapper.toRepo(context)]);
    expect(fake.insert).toHaveBeenCalledWith(reportingContextsInCore);
    expect(mockReportingContextHistoryRepo.save).toHaveBeenCalledWith(
      context,
      history,
      { ...options, tx: fake.innerTx }
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('rolls back the context insertion when history fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history failed');
    mockReportingContextHistoryRepo.save.mockRejectedValue(failure);
    await expect(repo.create(context, options)).rejects.toBe(failure);
    expect(fake.values).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });
});
