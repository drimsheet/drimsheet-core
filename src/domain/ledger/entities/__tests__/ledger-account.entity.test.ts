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

function makeCashAccount(
  status: ILedgerAccount['status'] = ELedgerAccountStatus.Active
) {
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
    status,
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

  it('preserves Draft on a complete subaccount, its created event, and its audit', () => {
    const [account, events, audit] = makeCashAccount(
      ELedgerAccountStatus.Draft
    );

    expect(account.status).toBe(ELedgerAccountStatus.Draft);
    expect(account.controlAccountId).not.toBeNull();
    expect(events).toEqual([
      expect.objectContaining({
        type: ELedgerAccountEvent.Created,
        data: account,
      }),
    ]);
    expect(audit.action).toBe(ELedgerAccountAuditAction.Created);
    expect(audit.diff.after.status).toBe(ELedgerAccountStatus.Draft);
    expect(Object.isFrozen(account)).toBe(true);
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

    it.each([
      ELedgerAccountStatus.Active,
      ELedgerAccountStatus.Archived,
      ELedgerAccountStatus.Draft,
    ])('validateStatus: accepts %s', (status) => {
      expect(() =>
        ledgerAccountValidation.validateStatus(status)
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

  describe('update', () => {
    it.each([new Date('2026-03-01T00:00:00.000Z'), null])(
      'updates only the opening balance date to %s without changing the name',
      (openingBalanceDate) => {
        const [account] = ledgerAccountEntity.make({
          ...validPayload,
          openingBalanceDate: new Date('2026-02-01T00:00:00.000Z'),
        });

        const [updatedAccount, events, audit] = ledgerAccountEntity.update(
          account,
          { openingBalanceDate }
        );

        expect(updatedAccount).toEqual({
          ...account,
          openingBalanceDate,
          version: account.version + 1,
          updatedAt: new Date(),
        });
        expect(account.openingBalanceDate).toEqual(
          new Date('2026-02-01T00:00:00.000Z')
        );
        expect(Object.isFrozen(updatedAccount)).toBe(true);
        expect(events).toEqual([
          expect.objectContaining({
            type: ELedgerAccountEvent.Updated,
            data: updatedAccount,
          }),
        ]);
        expect(audit).toMatchObject({
          action: ELedgerAccountAuditAction.Updated,
          diff: { before: account, after: updatedAccount },
        });
      }
    );

    it('rejects setting an opening balance date on a control account', () => {
      const [account] = ledgerAccountEntity.make({
        ...validPayload,
        isControlAccount: true,
      });

      expect(() =>
        ledgerAccountEntity.update(account, {
          openingBalanceDate: new Date('2026-03-01T00:00:00.000Z'),
        })
      ).toThrow(ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate);
      expect(account.openingBalanceDate).toBeNull();
      expect(account.version).toBe(1);
    });

    it('updates editable details in one version, event, and audit', () => {
      const [account] = makeCashAccount(ELedgerAccountStatus.Draft);
      const openingBalanceDate = new Date('2026-03-01T00:00:00.000Z');

      const [updatedAccount, events, audit] = ledgerAccountEntity.update(
        account,
        { name: '  Office cash  ', openingBalanceDate }
      );

      expect(updatedAccount).toMatchObject({
        id: account.id,
        name: 'Office cash',
        openingBalanceDate,
        version: account.version + 1,
      });
      expect(events).toEqual([
        expect.objectContaining({
          type: ELedgerAccountEvent.Updated,
          data: updatedAccount,
        }),
      ]);
      expect(audit).toMatchObject({
        action: ELedgerAccountAuditAction.Updated,
        diff: { before: account, after: updatedAccount },
      });
      expect(Object.isFrozen(updatedAccount)).toBe(true);
    });

    it('updates metadata in the same audited transition as editable details', () => {
      const [account] = ledgerAccountEntity.make({
        ...validPayload,
        subType: 'cash_and_cash_equivalent',
      });
      const meta = { bankName: 'Updated Bank' };
      const [updated, events, audit] = ledgerAccountEntity.update(account, {
        name: 'Updated account',
        meta,
      });
      expect(updated).toMatchObject({
        id: account.id,
        name: 'Updated account',
        meta,
        version: account.version + 1,
      });
      expect(account.meta).toEqual({ bankName: 'Test Bank' });
      expect(Object.isFrozen(updated.meta)).toBe(true);
      expect(events).toHaveLength(1);
      expect(audit?.diff).toEqual({ before: account, after: updated });
      expect(
        ledgerAccountEntity.update(updated, {
          meta: { bankName: 'Updated Bank' },
        })
      ).toEqual([updated, [], null]);
    });

    it('returns the original account without audit state when details are unchanged', () => {
      const [account] = makeCashAccount();

      expect(
        ledgerAccountEntity.update(account, { name: account.name })
      ).toEqual([account, [], null]);
    });
  });
});

describe('initial ledger opening balance date', () => {
  it.each([undefined, null, new Date('2026-01-01T00:00:00Z')])(
    'records the initial date in one creation tuple: %s',
    (openingBalanceDate) => {
      const [base] = makeCashAccount();
      const [account, events, audit] = ledgerAccountEntity.make({
        ...base,
        openingBalanceDate,
      });
      expect(account.openingBalanceDate).toEqual(openingBalanceDate ?? null);
      expect(account.version).toBe(1);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(account);
      expect(audit.diff).toMatchObject({ before: null, after: account });
      if (openingBalanceDate)
        expect(account.openingBalanceDate).not.toBe(openingBalanceDate);
    }
  );
  it.each([new Date('invalid'), new Date(Date.now() + 86400000)])(
    'rejects invalid or future initial dates: %s',
    (openingBalanceDate) => {
      const [base] = makeCashAccount();
      expect(() =>
        ledgerAccountEntity.make({ ...base, openingBalanceDate })
      ).toThrow(ledgerAccountError.InvalidOpeningBalanceDate);
    }
  );
  it('forbids initial dates on control accounts', () => {
    const [base] = makeCashAccount();
    expect(() =>
      ledgerAccountEntity.make({
        ...base,
        isControlAccount: true,
        openingBalanceDate: new Date('2026-01-01'),
      })
    ).toThrow(ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate);
  });
});

describe('ledger account archive', () => {
  afterEach(() => jest.useRealTimers());

  it.each(['active', 'draft'] as const)(
    'archives a %s account without changing accounting fields',
    (status) => {
      const [account] = makeCashAccount(status);
      jest
        .useFakeTimers()
        .setSystemTime(new Date(account.updatedAt.getTime() + 1000));
      const [archived, events, audit] = ledgerAccountEntity.archive(account);
      expect(archived).toEqual({
        ...account,
        status: 'archived',
        version: account.version + 1,
        updatedAt: new Date(),
      });
      expect(account.status).toBe(status);
      expect(Object.isFrozen(archived)).toBe(true);
      expect(events).toEqual([
        expect.objectContaining({
          type: ELedgerAccountEvent.Archived,
          data: archived,
        }),
      ]);
      expect(audit).toEqual(
        expect.objectContaining({
          action: ELedgerAccountAuditAction.Archived,
          entityVersion: archived.version,
          diff: { before: account, after: archived },
        })
      );
    }
  );

  it('returns an archived account unchanged without another audit or event', () => {
    const [account] = makeCashAccount('archived');
    const [archived, events, audit] = ledgerAccountEntity.archive(account);
    expect(archived).toBe(account);
    expect(events).toEqual([]);
    expect(audit).toBeNull();
  });
});
