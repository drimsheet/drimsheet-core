import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import bankDetailsValue from '@domain/ledger/values/bank-details.vo';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import bankAccountRepoImpl from '@infra/persistence/repos/ledger/bank-account.repo.impl';

jest.mock('../../../helpers/get-db-query', () => {
  return jest.fn();
});

describe('bankAccountRepoImpl', () => {
  const ledgerAccountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const mockGetDbQuery = getDbQuery as jest.Mock;

  const bankDetails: IBankDetails = bankDetailsValue.make({
    countryCode: 'NG',
    bankName: 'First Bank of Nigeria',
    accountName: 'Company Operating Account',
    accountNumber: '0123456789',
  });

  const rawRow = {
    bankName: bankDetails.bankName,
    accountNumber: bankDetails.accountNumber,
    accountName: bankDetails.accountName,
    countryCode: bankDetails.countryCode,
    accountingEntityId,
    ledgerAccountId,
    createdAt: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('returns bank account value when row exists', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([rawRow]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result = await bankAccountRepoImpl.findOne(
        bankDetails.bankName,
        bankDetails.accountNumber,
        { correlationId: 'test-id' }
      );

      expect(result).toEqual(bankDetails);
    });

    it('returns null when row does not exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result = await bankAccountRepoImpl.findOne(
        'Nonexistent Bank',
        '0000000000',
        { correlationId: 'test-id' }
      );

      expect(result).toBeNull();
    });

    it('uses empty repo options when none are supplied', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([rawRow]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result = await bankAccountRepoImpl.findOne(
        bankDetails.bankName,
        bankDetails.accountNumber
      );

      expect(mockGetDbQuery).toHaveBeenCalledWith({});
      expect(result).toEqual(bankDetails);
    });
  });

  describe('findByLedgerAccountId', () => {
    it('returns bank account value when row exists', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([rawRow]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result = await bankAccountRepoImpl.findByLedgerAccountId(
        ledgerAccountId,
        { correlationId: 'test-id' }
      );

      expect(result).toEqual(bankDetails);
    });

    it('returns null when row does not exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result = await bankAccountRepoImpl.findByLedgerAccountId(
        ledgerAccountId,
        { correlationId: 'test-id' }
      );

      expect(result).toBeNull();
    });

    it('uses empty repo options when none are supplied', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([rawRow]),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      const result =
        await bankAccountRepoImpl.findByLedgerAccountId(ledgerAccountId);

      expect(mockGetDbQuery).toHaveBeenCalledWith({});
      expect(result).toEqual(bankDetails);
    });
  });

  describe('update', () => {
    const options = { correlationId: 'bank-update', tx: {} };
    const query = { update: jest.fn(), set: jest.fn(), where: jest.fn() };
    beforeEach(() => {
      query.update.mockReturnValue(query);
      query.set.mockReturnValue(query);
      query.where.mockReset().mockResolvedValue({ rowCount: 1 });
      mockGetDbQuery.mockReturnValue(query);
    });

    it('updates scoped bank details using the caller transaction without replacing creation fields', async () => {
      await bankAccountRepoImpl.update(
        ledgerAccountId,
        accountingEntityId,
        bankDetails,
        options
      );
      expect(mockGetDbQuery).toHaveBeenCalledWith(options);
      expect(query.set).toHaveBeenCalledWith({
        ...bankDetails,
        updatedAt: expect.any(String),
      });
      const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
      expect(sql.sql).toContain('"ledger_account_id"');
      expect(sql.sql).toContain('"accounting_entity_id"');
      expect(sql.params).toEqual([ledgerAccountId, accountingEntityId]);
    });

    it('rejects a missing bank record so the caller cannot commit divergent metadata', async () => {
      query.where.mockResolvedValue({ rowCount: 0 });
      await expect(
        bankAccountRepoImpl.update(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.BankDetailsMissing);
    });

    it.each([
      { code: '23505', constraint: 'bank_accounts_pkey' },
      { cause: { code: '23505', constraint: 'bank_accounts_pkey' } },
    ])(
      'maps concurrent identity conflicts to DuplicateBankAccount: %j',
      async (error) => {
        query.where.mockRejectedValue(error);
        await expect(
          bankAccountRepoImpl.update(
            ledgerAccountId,
            accountingEntityId,
            bankDetails,
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
      }
    );

    it('propagates unrelated database failures', async () => {
      const failure = new Error('database unavailable');
      query.where.mockRejectedValue(failure);
      await expect(
        bankAccountRepoImpl.update(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          options
        )
      ).rejects.toBe(failure);
    });
  });

  describe('create', () => {
    it('inserts mapped model into database', async () => {
      const mockInsert = {
        values: jest.fn().mockResolvedValue(undefined),
      };
      const mockQuery = {
        insert: jest.fn().mockReturnValue(mockInsert),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      await bankAccountRepoImpl.create(
        ledgerAccountId,
        accountingEntityId,
        bankDetails,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId: 'test-id' }
      );

      expect(mockQuery.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          ledgerAccountId,
          accountingEntityId,
        })
      );
    });

    it('translates 23505 duplicate key error to DuplicateBankAccount', async () => {
      const dbErr = new Error('duplicate key value violates unique constraint');
      Object.assign(dbErr, { code: '23505', constraint: 'bank_accounts_pkey' });

      const mockInsert = {
        values: jest.fn().mockRejectedValue(dbErr),
      };
      const mockQuery = {
        insert: jest.fn().mockReturnValue(mockInsert),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      await expect(
        bankAccountRepoImpl.create(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          { correlationId: 'test-id' }
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
    });

    it.each([
      { code: '23505', constraint: 'bank_accounts_pkey' },
      { cause: { code: '23505', constraint: 'bank_accounts_pkey' } },
      { cause: { cause: { code: '23505', constraint: 'bank_accounts_pkey' } } },
    ])('translates named identity errors: %o', async (error) => {
      mockGetDbQuery.mockReturnValue({
        insert: jest
          .fn()
          .mockReturnValue({ values: jest.fn().mockRejectedValue(error) }),
      });
      await expect(
        bankAccountRepoImpl.create(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          ledgerAccountId,
          { correlationId: 'duplicate' }
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
    });
    it.each([
      null,
      'failure',
      { code: '23505', constraint: 'bank_accounts_ledger_account_id_uk' },
      { cause: { code: '23505', constraint: 'unrelated' } },
    ])('propagates non-identity errors: %o', async (error) => {
      mockGetDbQuery.mockReturnValue({
        insert: jest
          .fn()
          .mockReturnValue({ values: jest.fn().mockRejectedValue(error) }),
      });
      await expect(
        bankAccountRepoImpl.create(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          ledgerAccountId,
          { correlationId: 'failure' }
        )
      ).rejects.toBe(error);
    });

    it('rethrows non-duplicate insert errors', async () => {
      const dbErr = Object.assign(new Error('database unavailable'), {
        code: '08006',
      });

      const mockInsert = {
        values: jest.fn().mockRejectedValue(dbErr),
      };
      const mockQuery = {
        insert: jest.fn().mockReturnValue(mockInsert),
      };
      mockGetDbQuery.mockReturnValue(mockQuery);

      await expect(
        bankAccountRepoImpl.create(
          ledgerAccountId,
          accountingEntityId,
          bankDetails,
          'a1111111-1111-4111-8111-111111111111' as TEntityId,
          { correlationId: 'test-id' }
        )
      ).rejects.toBe(dbErr);
    });
  });
});
