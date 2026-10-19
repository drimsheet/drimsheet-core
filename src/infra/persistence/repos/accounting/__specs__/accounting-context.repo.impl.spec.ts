import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';

import { mockAccountingContextHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import { accountingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import repo from '@infra/persistence/repos/accounting/accounting-context.repo.impl';
import accountingContextMapper from '@infra/persistence/repos/accounting/mappers/accounting-context.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');

jest.mock(
  '@infra/persistence/repos/accounting/accounting-context-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingContextHistoryRepo,
  })
);

describe('accounting-context setup deletion', () => {
  it('deletes only the selected entity setup using the caller transaction', async () => {
    const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
    const options = { correlationId: 'remove', tx: {} };
    const where = jest.fn().mockResolvedValue(undefined);
    const query = { delete: jest.fn().mockReturnValue({ where }) };
    jest.mocked(getDbQuery).mockReturnValue(query as never);
    await repo.deleteByAccountingEntityId(id, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.delete).toHaveBeenCalledWith(accountingContextsInCore);
    expect(where).toHaveBeenCalledWith(
      eq(accountingContextsInCore.accountingEntityId, id)
    );
  });
});

describe('accounting-context atomic creation', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const [context, , audit] = accountingContextEntity.make({
    createdBy: id,
    accountingEntityId: id,
    fiscalYearId: id,
    currentAccountingPeriodId: id,
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  });
  const history = historyValue.make(audit, id, 'context');
  const options = { correlationId: 'context', tx: {}, history };
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
    expect(fake.committed).toEqual([accountingContextMapper.toRepo(context)]);
    expect(fake.insert).toHaveBeenCalledWith(accountingContextsInCore);
    expect(mockAccountingContextHistoryRepo.save).toHaveBeenCalledWith(
      context,
      history,
      { ...options, tx: fake.innerTx }
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('rolls back the context insertion when history fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history failed');
    mockAccountingContextHistoryRepo.save.mockRejectedValue(failure);
    await expect(repo.create(context, options)).rejects.toBe(failure);
    expect(fake.values).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });
});

describe('accounting-context lookup', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const row = {
    id,
    createdBy: id,
    accountingEntityId: id,
    name: 'Accounting context',
    description: null,
    accountingStandardCode: 'IFRS',
    fiscalYearId: id,
    currentOperatingPeriodId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
  };
  it.each([false, true])(
    'loads and maps a context by ID, found=%j',
    async (found) => {
      const options = { correlationId: 'context-read' };
      const limit = jest.fn().mockResolvedValue(found ? [row] : []);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      const result = await repo.findById(id, options);
      expect(result).toEqual(
        found ? accountingContextMapper.toDomain(row) : null
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(from).toHaveBeenCalledWith(accountingContextsInCore);
      expect(where).toHaveBeenCalledWith(eq(accountingContextsInCore.id, id));
      expect(limit).toHaveBeenCalledWith(1);
    }
  );
});
