import { eq, inArray, isNull, or } from 'drizzle-orm';

import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { EAssetSubType } from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountHistoryRepo from '@infra/persistence/repos/ledger/ledger-account-history.repo.impl';
import ledgerAccountRepo from '@infra/persistence/repos/ledger/ledger-account.repo.impl';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../ledger-account-history.repo.impl');
jest.mock('../mappers/ledger-account.mapper');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return {
    ...drizzle,
    eq: jest.fn(drizzle.eq),
    inArray: jest.fn(drizzle.inArray),
    isNull: jest.fn(drizzle.isNull),
    or: jest.fn(drizzle.or),
  };
});

describe('ledgerAccountRepo strict updates', () => {
  const account = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    version: 2,
  } as ILedgerAccount;
  const history = { entityId: account.id, entityVersion: 2 } as never;
  const repoModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: account.id,
    version: account.version,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ledgerAccountMapper.toRepo).mockReturnValue(repoModel);
  });

  function mockUpdate(rowCount: number) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const tx = { update };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
    } as unknown as ReturnType<typeof getDbQuery>);

    return set;
  }

  it('persists the supplied entity and predicates the update on expectedVersion', async () => {
    const set = mockUpdate(1);

    await ledgerAccountRepo.update(account, {
      correlationId: 'correlation-id',
      expectedVersion: 1,
      history,
    });

    expect(set).toHaveBeenCalledWith(repoModel);
    expect(eq).toHaveBeenCalledWith(ledgerAccountsInCore.version, 1);
    expect(ledgerAccountHistoryRepo.save).toHaveBeenCalled();
  });

  it('throws a version conflict without persisting history for a stale write', async () => {
    mockUpdate(0);

    await expect(
      ledgerAccountRepo.update(account, {
        correlationId: 'correlation-id',
        expectedVersion: 1,
        history,
      })
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);

    expect(ledgerAccountHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a history-version mismatch before opening a transaction', async () => {
    await expect(
      ledgerAccountRepo.update(account, {
        correlationId: 'correlation-id',
        expectedVersion: 1,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: account.id,
          entityVersion: 3,
        } as never,
      })
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);

    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountRepoImpl allocation reads', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeAwaitable(results: unknown[]) {
    return {
      then: (resolve: (value: unknown[]) => void) => resolve(results),
    };
  }

  function mockFindAllQuery(count: number, rows: unknown[] = []) {
    const countWhere = jest.fn().mockResolvedValue([{ count }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const offset = jest.fn().mockResolvedValue(rows);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const dataWhere = jest.fn().mockReturnValue({ orderBy });
    const leftJoin = jest.fn().mockReturnValue({ where: dataWhere });
    const dataFrom = jest.fn().mockReturnValue({ leftJoin });
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from: dataFrom });
    (getDbQuery as jest.Mock).mockReturnValue({ select });

    return { countWhere, dataWhere, limit, offset, select };
  }

  it('findByCode maps an allocation read', async () => {
    const row = { id: 'account-row' };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
    } as ILedgerAccount;
    const awaitable = makeAwaitable([row]);
    const where = jest.fn().mockReturnValue(awaitable);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    await expect(
      ledgerAccountRepo.findByCode('100000', accountingEntityId, {
        correlationId: 'correlation-id',
      })
    ).resolves.toBe(account);

    expect(leftJoin).toHaveBeenCalled();
  });

  it('findLatestBySubType maps the latest allocation read', async () => {
    const latest = {
      id: 'latest-id',
      code: '100001',
      materializedPath: '100000.100001',
    };
    const awaitable = makeAwaitable([latest]);
    const limit = jest.fn().mockReturnValue(awaitable);
    const orderBy = jest.fn().mockReturnValue({ limit });
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });

    await expect(
      ledgerAccountRepo.findLatestBySubType(
        accountingEntityId,
        ELedgerType.Asset,
        EAssetSubType.CashAndCashEquivalent,
        { correlationId: 'correlation-id' }
      )
    ).resolves.toEqual(latest);
  });

  it.each([
    [
      'findById',
      () =>
        ledgerAccountRepo.findById(
          'account-id' as TEntityId,
          accountingEntityId,
          {
            correlationId: 'correlation-id',
          }
        ),
    ],
    [
      'findAllByIds',
      () =>
        ledgerAccountRepo.findAllByIds(['account-id' as TEntityId], {
          correlationId: 'correlation-id',
        }),
    ],
    [
      'findBySubType',
      () =>
        ledgerAccountRepo.findBySubType(
          accountingEntityId,
          ELedgerType.Asset,
          EAssetSubType.CashAndCashEquivalent,
          { correlationId: 'correlation-id' }
        ),
    ],
    [
      'findByBehavior',
      () =>
        ledgerAccountRepo.findByBehavior(accountingEntityId, 'POSTING', {
          correlationId: 'correlation-id',
        }),
    ],
  ])('%s retains a row without a currency relation', async (_name, read) => {
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const where = jest.fn().mockResolvedValue([row]);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    const result = await read();

    expect(leftJoin).toHaveBeenCalled();
    expect(ledgerAccountMapper.toDomain).toHaveBeenCalledWith(row, 0, [row]);
    expect(result).toEqual(_name === 'findById' ? account : [account]);
  });

  it('findAll retains a paginated row without a currency relation', async () => {
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const countWhere = jest.fn().mockResolvedValue([{ count: 1 }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const offset = jest.fn().mockResolvedValue([row]);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const dataWhere = jest.fn().mockReturnValue({ orderBy });
    const leftJoin = jest.fn().mockReturnValue({ where: dataWhere });
    const dataFrom = jest.fn().mockReturnValue({ leftJoin });
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from: dataFrom });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    const result = await ledgerAccountRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
    });

    expect(leftJoin).toHaveBeenCalled();
    expect(result.data).toEqual([account]);
  });

  it('findAll applies plural posting restrictions and fixed-or-null currency before count and pagination', async () => {
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const query = mockFindAllQuery(25, [row]);
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    const result = await ledgerAccountRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      types: [ELedgerType.Revenue, ELedgerType.Liability],
      subTypes: [EAssetSubType.CashAndCashEquivalent],
      behaviors: [ELedgerAccountBehavior.Bank],
      currencyCodes: ['USD', null],
      isControlAccount: false,
      limit: 10,
      offset: 10,
    });

    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.type, [
      ELedgerType.Revenue,
      ELedgerType.Liability,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.subType, [
      EAssetSubType.CashAndCashEquivalent,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.behavior, [
      ELedgerAccountBehavior.Bank,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode, [
      'USD',
    ]);
    expect(isNull).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode);
    expect(or).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(eq).toHaveBeenCalledWith(
      ledgerAccountsInCore.isControlAccount,
      false
    );
    expect(query.countWhere).toHaveBeenCalledWith(expect.anything());
    expect(query.dataWhere).toHaveBeenCalledWith(
      query.countWhere.mock.calls[0][0]
    );
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      data: [account],
      meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('findAll preserves unfiltered reads and skips the data query when no rows match', async () => {
    const query = mockFindAllQuery(0);

    const result = await ledgerAccountRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      types: [],
      subTypes: [],
      behaviors: [],
      currencyCodes: [],
    });

    expect(inArray).not.toHaveBeenCalled();
    expect(isNull).not.toHaveBeenCalled();
    expect(query.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('findAll supports a fixed-currency-only filter', async () => {
    mockFindAllQuery(0);

    await ledgerAccountRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      currencyCodes: ['USD'],
    });

    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode, [
      'USD',
    ]);
    expect(isNull).not.toHaveBeenCalled();
  });

  it('findAll supports a null-currency-only filter', async () => {
    mockFindAllQuery(0);

    await ledgerAccountRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      currencyCodes: [null],
    });

    expect(inArray).not.toHaveBeenCalled();
    expect(isNull).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode);
  });

  it('findAllByMaterializedPath returns exact paths within the accounting entity', async () => {
    const materializedPaths = ['100000', '100000.100001'];
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const where = jest.fn().mockResolvedValue([row]);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    await expect(
      ledgerAccountRepo.findAllByMaterializedPath(
        accountingEntityId,
        materializedPaths,
        { correlationId: 'correlation-id' }
      )
    ).resolves.toEqual([account]);

    expect(eq).toHaveBeenCalledWith(
      ledgerAccountsInCore.accountingEntityId,
      accountingEntityId
    );
    expect(inArray).toHaveBeenCalledWith(
      ledgerAccountsInCore.materializedPath,
      materializedPaths
    );
  });

  it('findAllByMaterializedPath skips the query when no paths are requested', async () => {
    await expect(
      ledgerAccountRepo.findAllByMaterializedPath(accountingEntityId, [], {
        correlationId: 'correlation-id',
      })
    ).resolves.toEqual([]);

    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountRepo.findByCodeForUpdate', () => {
  const entityId = 'b2222222-2222-4222-8222-222222222222' as TEntityId;
  const headerId = 'c3333333-3333-4333-8333-333333333333' as TEntityId;
  const tx: ITransactionContext = {};
  const options = { correlationId: 'locked-read', tx };

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  function lockedQuery(rows: Array<{ id: TEntityId }>) {
    const lock = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ for: lock });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ select } as unknown as ReturnType<typeof getDbQuery>);
    return { lock, where };
  }

  it('locks only the scoped account row before retrieving its domain representation', async () => {
    const { lock } = lockedQuery([{ id: headerId }]);
    const account = { id: headerId } as ILedgerAccount;
    const find = jest
      .spyOn(ledgerAccountRepo, 'findById')
      .mockResolvedValueOnce(account);
    await expect(
      ledgerAccountRepo.findByCodeForUpdate('100000', entityId, options)
    ).resolves.toBe(account);
    expect(lock).toHaveBeenCalledWith('update');
    expect(eq).toHaveBeenCalledWith(
      ledgerAccountsInCore.accountingEntityId,
      entityId
    );
    expect(eq).toHaveBeenCalledWith(ledgerAccountsInCore.code, '100000');
    expect(find).toHaveBeenCalledWith(headerId, entityId, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('returns null when no row can be locked', async () => {
    lockedQuery([]);
    await expect(
      ledgerAccountRepo.findByCodeForUpdate('100000', entityId, options)
    ).resolves.toBeNull();
  });

  it('rejects a missing transaction before querying', async () => {
    await expect(
      // @ts-expect-error Exercise an untyped caller that omits the required transaction.
      ledgerAccountRepo.findByCodeForUpdate('100000', entityId, {
        correlationId: 'spec',
      })
    ).rejects.toBeInstanceOf(repoError.TransactionRequired);
    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountRepo suspense duplicate translation', () => {
  const conflict = {
    code: '23505',
    constraint: 'ledger_accounts_suspense_entity_type_currency_uk',
  };
  beforeEach(() => jest.resetAllMocks());

  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the named suspense violation %o',
    async (error) => {
      jest.mocked(getDbQuery).mockReturnValue({
        transaction: jest.fn().mockRejectedValue(error),
      } as unknown as ReturnType<typeof getDbQuery>);
      await expect(
        ledgerAccountRepo.create([], {
          correlationId: 'duplicate',
          history: [],
        })
      ).rejects.toBeInstanceOf(ledgerAccountError.SuspenseAccountAlreadyExists);
    }
  );
  it.each([
    null,
    'failure',
    {},
    { code: '23505' },
    {
      code: '23505',
      constraint: 'ledger_accounts_code_accounting_entity_id_uk',
    },
    {
      code: '23505',
      constraint: 'ledger_accounts_path_accounting_entity_id_uk',
    },
    {
      code: '23514',
      constraint: 'ledger_accounts_suspense_currency_required_ck',
    },
    { cause: new Error('database unavailable') },
  ])('preserves an unrelated failure %o', async (error) => {
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn().mockRejectedValue(error),
    } as unknown as ReturnType<typeof getDbQuery>);
    await expect(
      ledgerAccountRepo.create([], {
        correlationId: 'other-error',
        history: [],
      })
    ).rejects.toBe(error);
  });
});

describe('ledgerAccountRepo atomic creation', () => {
  const account = { id: generateUUID(), version: 1 } as ILedgerAccount;
  const mapped = { id: String(account.id) } as ReturnType<
    typeof ledgerAccountMapper.toRepo
  >;
  const options = { correlationId: 'create', history: [] };
  beforeEach(() => jest.resetAllMocks());

  function mockCreation() {
    const values = jest.fn().mockResolvedValue(undefined);
    const tx = { insert: jest.fn().mockReturnValue({ values }) };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (fn) => fn(tx as never)),
    } as unknown as ReturnType<typeof getDbQuery>);
    jest.mocked(ledgerAccountMapper.toRepo).mockReturnValue(mapped);
    return { values, tx };
  }

  it.each([false, true])(
    'writes accounts and histories within one transaction (array: %s)',
    async (array) => {
      const { values, tx } = mockCreation();
      await ledgerAccountRepo.create(array ? [account] : account, options);
      expect(values).toHaveBeenCalledWith([mapped]);
      expect(tx.insert).toHaveBeenCalledWith(ledgerAccountsInCore);
      expect(ledgerAccountHistoryRepo.save).toHaveBeenCalledWith([], {
        ...options,
        tx,
      });
    }
  );

  it('does not swallow a history failure after insertion', async () => {
    const { values } = mockCreation();
    const failure = new Error('history insert failed');
    jest.mocked(ledgerAccountHistoryRepo.save).mockRejectedValueOnce(failure);
    await expect(ledgerAccountRepo.create(account, options)).rejects.toBe(
      failure
    );
    expect(values).toHaveBeenCalledTimes(1);
  });
});
