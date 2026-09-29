import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import getContraLedgerAccountBalance from '@domain/ledger/entities/helpers/get-contra-balance.helper';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountValidation from '@domain/ledger/entities/validations/ledger-account.validation';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerAccountEvent } from '@domain/ledger/events/ledger-account.events';
import { ELedgerAccountAuditAction } from '@domain/ledger/types/ledger-account-audit.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

function makeCashAccount() {
  return ledgerAccountEntity.make({
    code: '100001',
    materializedPath: '100000.100001',
    accountingEntityId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
    name: 'Petty cash',
    type: ELedgerType.Asset,
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: ENormalBalance.Debit,
    isControlAccount: false,
    currency: SYSTEM_CURRENCIES.NGN,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    meta: null,
  });
}

describe('Ledger Account Shared Entity', () => {
  const validUUID1 = generateUUID();
  const validUUID2 = generateUUID();
  const validUUID3 = generateUUID();

  const validCurrency: any = {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    minorUnit: 2,
  };

  const validPayload: TCreationOmits<ILedgerAccount, 'openingBalanceDate'> = {
    code: '101001',
    materializedPath: '101001',
    accountingEntityId: validUUID1,
    type: ELedgerType.Asset,
    subType: 'cash',
    behavior: 'bank',
    normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
    isControlAccount: false,
    controlAccountId: null,
    name: 'Main Bank Account',
    currency: validCurrency,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    meta: { bankName: 'Test Bank' },
    createdBy: validUUID2,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it.each([
    '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
    '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])('preserves immutable $type creation attribution', (createdBy) => {
    const [entity] = ledgerAccountEntity.make({ ...validPayload, createdBy });
    expect(entity.createdBy).toBe(createdBy);
    expect(Object.isFrozen(entity.createdBy)).toBe(true);
  });

  describe('Validation Functions', () => {
    it('validateCode: should not throw for valid ledger codes', () => {
      expect(() =>
        ledgerAccountValidation.validateCode('100000')
      ).not.toThrow();
      expect(() =>
        ledgerAccountValidation.validateCode('599999')
      ).not.toThrow();
    });

    it('validateCode: should throw AppError for invalid ledger codes', () => {
      expect(() => ledgerAccountValidation.validateCode('001000')).toThrow();
      expect(() => ledgerAccountValidation.validateCode('600000')).toThrow();
      expect(() => ledgerAccountValidation.validateCode('10100')).toThrow();
      expect(() => ledgerAccountValidation.validateCode('1010011')).toThrow();
      expect(() => ledgerAccountValidation.validateCode('101abc')).toThrow();
    });

    it('validateType: should not throw for valid types', () => {
      expect(() =>
        ledgerAccountValidation.validateType(ELedgerType.Asset)
      ).not.toThrow();
    });

    it('validateType: should throw AppError for invalid type', () => {
      expect(() => {
        // @ts-expect-error testing invalid type
        ledgerAccountValidation.validateType('invalid');
      }).toThrow();
    });

    it('validateStatus: should not throw for valid statuses', () => {
      expect(() =>
        ledgerAccountValidation.validateStatus(ELedgerAccountStatus.Active)
      ).not.toThrow();
    });

    it('validateStatus: should throw AppError for invalid status', () => {
      expect(() => {
        // @ts-expect-error testing invalid status
        ledgerAccountValidation.validateStatus('invalid');
      }).toThrow();
    });

    it('validateContraRule: should not throw for valid contra rules', () => {
      expect(() =>
        ledgerAccountValidation.validateContraRule(
          EContraAccountRule.ContraPermitted
        )
      ).not.toThrow();
    });

    it('validateContraRule: should throw AppError for invalid contra rule', () => {
      expect(() => {
        // @ts-expect-error testing invalid contra rule
        ledgerAccountValidation.validateContraRule('invalid');
      }).toThrow();
    });

    it('validateAdjunctRule: should not throw for valid adjunct rules', () => {
      expect(() =>
        ledgerAccountValidation.validateAdjunctRule(
          EAdjunctAccountRule.AdjunctPermitted
        )
      ).not.toThrow();
    });

    it('validateAdjunctRule: should throw AppError for invalid adjunct rule', () => {
      expect(() => {
        // @ts-expect-error testing invalid adjunct rule
        ledgerAccountValidation.validateAdjunctRule('invalid');
      }).toThrow();
    });

    it('validateMaterializedPath: should not throw for valid lengths', () => {
      expect(() =>
        ledgerAccountValidation.validateMaterializedPath('100000')
      ).not.toThrow();
      expect(() =>
        ledgerAccountValidation.validateMaterializedPath(
          '100000.100001.100002.100003.100004.100005.100006.100007.100008.100009'
        )
      ).not.toThrow(); // 69 characters
    });

    it('validateMaterializedPath: should throw AppError for invalid lengths', () => {
      expect(() =>
        ledgerAccountValidation.validateMaterializedPath('10000')
      ).toThrow(); // 5 chars
      // 70 chars
      expect(() =>
        ledgerAccountValidation.validateMaterializedPath(
          '100000.100001.100002.100003.100004.100005.100006.100007.100008.100009x'
        )
      ).toThrow();
    });
  });

  describe('getNextSubledgerAccountCode', () => {
    it('should generate the next sub-ledger code correctly', () => {
      expect(getNextSubledgerAccountCode('101', '101000')).toBe('101001');
      expect(getNextSubledgerAccountCode('101', '101009')).toBe('101010');
      expect(getNextSubledgerAccountCode('300', '300099')).toBe('300100');
    });

    it('should throw if headerCode has invalid format', () => {
      expect(() => getNextSubledgerAccountCode('10', '100000')).toThrow();
      expect(() => getNextSubledgerAccountCode('601', '601000')).toThrow();
    });

    it('should throw if predecessorCode does not start with the headerCode or has invalid length', () => {
      expect(() => getNextSubledgerAccountCode('101', '102000')).toThrow();
      expect(() => getNextSubledgerAccountCode('101', '10100')).toThrow();
    });

    it('should throw if limit is reached (999)', () => {
      expect(() => getNextSubledgerAccountCode('101', '101999')).toThrow();
    });
  });

  describe('getLedgerAccountMaterializedPath', () => {
    it('returns a correct appended materialized path', () => {
      expect(getLedgerAccountMaterializedPath('100000', '100001')).toBe(
        '100000.100001'
      );
    });

    it('throws AppError if parent path is too short', () => {
      expect(() =>
        getLedgerAccountMaterializedPath('10000', '100001')
      ).toThrow();
    });

    it('throws AppError if parent path is too long', () => {
      // 63 characters
      expect(() =>
        getLedgerAccountMaterializedPath(
          '100000.100001.100002.100003.100004.100005.100006.100007.100008.',
          '100009'
        )
      ).toThrow();
    });
  });

  describe('getMaterializedPaths', () => {
    it('returns every unique account and ancestor path', () => {
      const [firstAccount] = ledgerAccountEntity.make({
        ...validPayload,
        materializedPath: '100000.100001.100002',
      });
      const [secondAccount] = ledgerAccountEntity.make({
        ...validPayload,
        materializedPath: '100000.100003',
      });

      expect(
        ledgerAccountEntity.getMaterializedPaths([firstAccount, secondAccount])
      ).toEqual([
        '100000',
        '100000.100001',
        '100000.100001.100002',
        '100000.100003',
      ]);
    });
  });

  describe('getLedgerAccountNormalBalance', () => {
    it('returns Debit for Asset and Expense', () => {
      expect(getLedgerAccountNormalBalance(ELedgerType.Asset)).toBe(
        ENormalBalance.Debit
      );
      expect(getLedgerAccountNormalBalance(ELedgerType.Expense)).toBe(
        ENormalBalance.Debit
      );
    });

    it('returns Credit for Liability, Equity, and Revenue', () => {
      expect(getLedgerAccountNormalBalance(ELedgerType.Liability)).toBe(
        ENormalBalance.Credit
      );
      expect(getLedgerAccountNormalBalance(ELedgerType.Equity)).toBe(
        ENormalBalance.Credit
      );
      expect(getLedgerAccountNormalBalance(ELedgerType.Revenue)).toBe(
        ENormalBalance.Credit
      );
    });

    it('throws AppError for invalid ledger type', () => {
      expect(() => {
        // @ts-expect-error testing invalid type
        getLedgerAccountNormalBalance('INVALID_TYPE');
      }).toThrow();
    });
  });

  describe('getContraLedgerAccountBalance', () => {
    it('returns Credit when normal balance is Debit', () => {
      expect(getContraLedgerAccountBalance(ENormalBalance.Debit)).toBe(
        ENormalBalance.Credit
      );
    });

    it('returns Debit when normal balance is Credit', () => {
      expect(getContraLedgerAccountBalance(ENormalBalance.Credit)).toBe(
        ENormalBalance.Debit
      );
    });

    it('throws AppError for invalid normal balance', () => {
      expect(() => {
        // @ts-expect-error testing invalid balance
        getContraLedgerAccountBalance('INVALID_BALANCE');
      }).toThrow();
    });
  });

  describe('make', () => {
    it('should successfully create a ledger account with valid inputs', () => {
      const [account, events, audit] = ledgerAccountEntity.make(validPayload);

      expect(typeof account.id).toBe('string');
      expect(account.code).toBe('101001');
      expect(account.materializedPath).toBe('101001');
      expect(account.accountingEntityId).toBe(validUUID1);
      expect(account.type).toBe(ELedgerType.Asset);
      expect(account.normalBalance).toBe(ENormalBalance.Debit);
      expect(account.isControlAccount).toBe(false);
      expect(account.controlAccountId).toBeNull();
      expect(account.name).toBe('Main Bank Account');
      expect(account.meta).toEqual({ bankName: 'Test Bank' });
      expect(account.version).toBe(1);
      expect(account.createdAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
      expect(account.updatedAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
      expect(account.deletedAt).toBeNull();
      expect(Object.isFrozen(account)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(ELedgerAccountEvent.Created);
      expect(events[0].data).toEqual(account);

      expect(audit).toEqual({
        entityId: account.id,
        entityVersion: account.version,
        action: ELedgerAccountAuditAction.Created,
        diff: {
          before: null,
          after: account,
        },
        occurredAt: account.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('preserves a null currency in the account, event, and audit', () => {
      const [account, events, audit] = ledgerAccountEntity.make({
        ...validPayload,
        currency: null,
      });

      expect(account.currency).toBeNull();
      expect(events[0].data.currency).toBeNull();
      expect(audit.diff.after.currency).toBeNull();
    });

    it('should successfully create a ledger account with a control account ID', () => {
      const payloadWithControl = {
        ...validPayload,
        isControlAccount: true,
        controlAccountId: validUUID3,
      };
      const [account] = ledgerAccountEntity.make(payloadWithControl);
      expect(account.isControlAccount).toBe(true);
      expect(account.controlAccountId).toBe(validUUID3);
    });

    it('should throw if accountingEntityId is invalid UUID', () => {
      const invalidPayload = {
        ...validPayload,
        accountingEntityId: 'invalid' as TEntityId,
      };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if controlAccountId is invalid UUID when provided', () => {
      const invalidPayload = {
        ...validPayload,
        controlAccountId: 'invalid' as TEntityId,
      };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if createdBy is an invalid actor', () => {
      const invalidPayload = {
        ...validPayload,
        createdBy: 'invalid' as unknown as TEntityId,
      };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if name is too short', () => {
      const invalidPayload = { ...validPayload, name: 'A' };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if subType is empty', () => {
      const invalidPayload = { ...validPayload, subType: '' };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if behavior is empty', () => {
      const invalidPayload = { ...validPayload, behavior: '' };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if currency validation fails', () => {
      const invalidPayload = {
        ...validPayload,
        currency: { ...validCurrency, code: 'INVALID' },
      };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if isControlAccount is not a boolean', () => {
      const invalidPayload = {
        ...validPayload,
        isControlAccount: 'yes',
      };
      // @ts-expect-error testing invalid control account flag
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if normalBalance is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        normalBalance: 'invalid',
      };
      // @ts-expect-error testing invalid normal balance
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should pass if meta is null', () => {
      const payload = { ...validPayload, meta: null };
      const [account] = ledgerAccountEntity.make(payload);
      expect(account.meta).toBeNull();
    });

    it('should throw if meta is invalid (e.g. string)', () => {
      const invalidPayload = {
        ...validPayload,
        meta: 'invalid string',
      };
      // @ts-expect-error testing invalid meta
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if materializedPath is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        materializedPath: '12345',
      };
      expect(() => ledgerAccountEntity.make(invalidPayload)).toThrow();
    });

    it('should initialize openingBalanceDate to null by default', () => {
      const [account] = ledgerAccountEntity.make(validPayload);
      expect(account.openingBalanceDate).toBeNull();
    });
  });

  describe('updateOpeningBalanceDate', () => {
    it('should update openingBalanceDate and return updated entity, event, and audit', () => {
      const [account] = ledgerAccountEntity.make(validPayload);
      const openingDate = new Date('2026-01-01');

      const [updatedAccount, events, audit] =
        ledgerAccountEntity.updateOpeningBalanceDate(account, openingDate);

      expect(updatedAccount.openingBalanceDate).toEqual(openingDate);
      expect(updatedAccount.version).toBe(account.version + 1);
      expect(updatedAccount.updatedAt.getTime()).toBeGreaterThanOrEqual(
        account.updatedAt.getTime()
      );
      expect(Object.isFrozen(updatedAccount)).toBe(true);
      expect(account.openingBalanceDate).toBeNull(); // immutability

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(ELedgerAccountEvent.Updated);
      expect(events[0].data).toEqual(updatedAccount);

      expect(audit.action).toBe(ELedgerAccountAuditAction.Updated);
      expect(audit.entityVersion).toBe(updatedAccount.version);
      expect(audit.diff.before).toEqual(account);
      expect(audit.diff.after).toEqual(updatedAccount);
    });

    it('should throw when openingBalanceDate is invalid or in the future', () => {
      const [account] = ledgerAccountEntity.make(validPayload);

      expect(() =>
        // @ts-expect-error testing invalid date
        ledgerAccountEntity.updateOpeningBalanceDate(account, null)
      ).toThrow();
      expect(() =>
        ledgerAccountEntity.updateOpeningBalanceDate(
          account,
          new Date('invalid')
        )
      ).toThrow();

      const futureDate = new Date(Date.now() + 86400000 * 10);
      expect(() =>
        ledgerAccountEntity.updateOpeningBalanceDate(account, futureDate)
      ).toThrow();
    });

    it('should throw when account is a control account', () => {
      const controlPayload = { ...validPayload, isControlAccount: true };
      const [controlAccount] = ledgerAccountEntity.make(controlPayload);

      expect(() =>
        ledgerAccountEntity.updateOpeningBalanceDate(
          controlAccount,
          new Date('2026-01-01')
        )
      ).toThrow();
    });

    it('should throw when openingBalanceDate is already set', () => {
      const [account] = ledgerAccountEntity.make(validPayload);
      const openingDate = new Date('2026-01-01');
      const [updatedAccount] = ledgerAccountEntity.updateOpeningBalanceDate(
        account,
        openingDate
      );

      expect(() =>
        ledgerAccountEntity.updateOpeningBalanceDate(
          updatedAccount,
          new Date('2026-02-01')
        )
      ).toThrow();
    });
  });
});

describe('ledgerAccountEntity.updateCode', () => {
  it('returns an immutable code/path update with an event and before/after audit', () => {
    const [account] = makeCashAccount();
    const original = structuredClone(account);
    const now = new Date('2026-09-29T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);
    try {
      const [updated, events, audit] = ledgerAccountEntity.updateCode(
        account,
        '100009'
      );

      expect(updated).toEqual({
        ...account,
        code: '100009',
        materializedPath: '100000.100009',
        version: account.version + 1,
        updatedAt: now,
      });
      expect(account).toEqual(original);
      expect(Object.isFrozen(updated)).toBe(true);
      expect(Object.isFrozen(updated.currency)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: ELedgerAccountEvent.Updated,
        data: updated,
      });
      expect(audit).toEqual({
        entityId: account.id,
        entityVersion: updated.version,
        action: ELedgerAccountAuditAction.Updated,
        diff: { before: account, after: updated },
        occurredAt: now,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['100001', '100000.100001', '100000.100005.100001'])(
    'replaces only the final path segment of %s',
    (materializedPath) => {
      const [createdAccount] = makeCashAccount();
      const [account] = ledgerAccountEntity.make({
        ...createdAccount,
        materializedPath,
      });
      const [updated] = ledgerAccountEntity.updateCode(account, '100009');
      expect(updated.materializedPath).toBe(
        materializedPath.replace(/100001$/, '100009')
      );
    }
  );

  it('preserves an existing opening balance date as an ordinary account field', () => {
    const [createdAccount] = makeCashAccount();
    const [account] = ledgerAccountEntity.updateOpeningBalanceDate(
      createdAccount,
      new Date('2026-01-01T00:00:00Z')
    );
    const [updated] = ledgerAccountEntity.updateCode(account, '100009');
    expect(updated.openingBalanceDate).toEqual(account.openingBalanceDate);
    expect(updated.version).toBe(account.version + 1);
  });

  it.each(['100bad', '600001', '10001'])('rejects invalid code %s', (code) => {
    const [createdAccount] = makeCashAccount();
    expect(() => ledgerAccountEntity.updateCode(createdAccount, code)).toThrow(
      ledgerAccountError.InvalidCode
    );
  });
});

describe('ledgerAccountEntity.assignNextCode', () => {
  it('derives the next code from the latest account and preserves the created account parent path', () => {
    const [createdAccount] = makeCashAccount();
    const [account] = ledgerAccountEntity.make({
      ...createdAccount,
      materializedPath: '100000.100005.100001',
    });
    const [updated, events, audit] = ledgerAccountEntity.assignNextCode(
      account,
      { code: '100019' }
    );
    expect(updated).toMatchObject({
      id: account.id,
      code: '100020',
      materializedPath: '100000.100005.100020',
      version: account.version + 1,
    });
    expect(account.code).toBe('100001');
    expect(events[0].data).toEqual(updated);
    expect(audit.diff).toEqual({ before: account, after: updated });
  });

  it.each([
    ['100999', ledgerAccountError.MaximumLimitReached],
    ['102001', ledgerAccountError.InvalidPredecessorCode],
    ['100bad', ledgerAccountError.InvalidCode],
  ])('rejects an unavailable or invalid latest code %s', (code, error) => {
    const [createdAccount] = makeCashAccount();
    expect(() =>
      ledgerAccountEntity.assignNextCode(createdAccount, { code })
    ).toThrow(error);
  });
});
