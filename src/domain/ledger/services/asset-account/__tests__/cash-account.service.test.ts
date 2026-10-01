import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};

describe('cashAccountService', () => {
  const service = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const mockOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T00:00:00.000Z'));
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the cash header in functional currency', async () => {
    const ownerId = generateUUID();
    const accountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      ownerId,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    } as IAccountingEntity;
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [account] = await service.createHeader(
      {
        name: 'Cash',
        createdBy: ownerId,
        accountingEntity,
      },
      mockOptions
    );

    expect(account.currency).toBe(SYSTEM_CURRENCIES.NGN);
  });

  it('rejects a duplicate cash header', async () => {
    const ownerId = generateUUID();
    const accountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      ownerId,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    } as IAccountingEntity;
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    const [existingHeader] = await service.createHeader(
      {
        name: 'Cash',
        createdBy: ownerId,
        accountingEntity,
      },
      mockOptions
    );

    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);

    await expect(
      service.createHeader(
        {
          name: 'Cash',
          createdBy: ownerId,
          accountingEntity,
        },
        mockOptions
      )
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
      cause: { existingHeader },
    });
  });

  describe.each(['petty_cash', 'bank'] as const)(
    '%s in-memory creation',
    (kind) => {
      const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
      let accountingEntity: IAccountingEntity;
      let parent: ILedgerAccount;
      const bankDetails = {
        countryCode: 'NG',
        bankName: 'Test Bank',
        accountName: 'Main account',
        accountNumber: '0123456789',
      };

      beforeEach(async () => {
        [accountingEntity] = accountingEntityEntity.make({
          name: 'Test business',
          type: 'individual',
          ownerId: actorId,
          createdBy: actorId,
          functionalCurrencyCode: 'NGN',
          jurisdictionCode: 'NG',
        });
        [parent] = await service.createHeader(
          { name: 'Cash', accountingEntity, createdBy: actorId },
          mockOptions
        );
        jest.clearAllMocks();
        for (const method of Object.values(mockLedgerAccountRepo)) {
          method.mockImplementation(() => {
            throw new Error('Creation must not access the repository');
          });
        }
      });

      function prepare(
        overrides: Partial<
          Parameters<typeof service.createBankSubAccount>[0]
        > = {}
      ) {
        const payload = {
          name: 'New cash account',
          accountingEntity,
          createdBy: actorId,
          controlAccount: parent,
          isControlAccount: false,
          currency: SYSTEM_CURRENCIES.NGN,
          bankDetails,
          ...overrides,
        };
        return kind === 'bank'
          ? service.createBankSubAccount(payload)
          : service.createPettyCashSubAccount(payload);
      }

      it('creates synchronously without any repository calls and retains immutable events and audit', () => {
        const [account, events, audit] = prepare();
        expect(account).toMatchObject({
          code: '100001',
          materializedPath: '100000.100001',
          controlAccountId: parent.id,
          accountingEntityId: accountingEntity.id,
          behavior: kind,
        });
        expect(events[0].data).toEqual(account);
        expect(audit.diff.after).toEqual(account);
        expect(Object.isFrozen(account)).toBe(true);
        expect(account.meta).toEqual(kind === 'bank' ? bankDetails : null);
        for (const method of Object.values(mockLedgerAccountRepo))
          expect(method).not.toHaveBeenCalled();
      });

      it('derives its candidate from a nested parent without changing the parent', () => {
        const [nestedParent] = ledgerAccountEntity.make({
          ...parent,
          code: '100010',
          materializedPath: '100000.100010',
          controlAccountId: parent.id,
          behavior: kind,
        });
        const [account] = prepare({ controlAccount: nestedParent });
        expect(account).toMatchObject({
          code: '100011',
          materializedPath: '100000.100010.100011',
          controlAccountId: nestedParent.id,
        });
        expect(nestedParent.code).toBe('100010');
      });

      it('allows foreign currency under the cash header', () => {
        expect(
          prepare({ currency: SYSTEM_CURRENCIES.USD })[0].currency
        ).toEqual(SYSTEM_CURRENCIES.USD);
      });

      it('rejects a currency mismatch under a nested parent', () => {
        const [nestedParent] = ledgerAccountEntity.make({
          ...parent,
          code: '100010',
          materializedPath: '100000.100010',
          controlAccountId: parent.id,
          behavior: kind,
        });
        expect(() =>
          prepare({
            controlAccount: nestedParent,
            currency: SYSTEM_CURRENCIES.USD,
          })
        ).toThrow(
          'ledger_error_ledger_account_control_account_currency_mismatch_invalid'
        );
      });

      it('rejects an exhausted parent predecessor', () => {
        const [exhausted] = ledgerAccountEntity.updateCode(parent, '100999');
        expect(() => prepare({ controlAccount: exhausted })).toThrow(
          'ledger_error_ledger_account_maximum_limit_reached_conflict'
        );
      });

      it.each([
        { type: ELedgerType.Liability },
        { subType: EAssetSubType.Receivables },
        { isControlAccount: false },
        {
          behavior:
            kind === 'bank'
              ? EAssetAccountBehavior.PettyCash
              : EAssetAccountBehavior.Bank,
        },
        {
          accountingEntityId:
            'b1111111-1111-4111-8111-111111111111' as TEntityId,
        },
      ])('rejects an invalid supplied parent: %o', (invalid) => {
        expect(() =>
          prepare({ controlAccount: { ...parent, ...invalid } })
        ).toThrow('ledger_error_asset_account_control_account_invalid');
      });

      it('retains name validation', () => {
        expect(() => prepare({ name: ' ' })).toThrow(
          'ledger_error_ledger_account_name_invalid'
        );
      });

      it('retains creator validation', () => {
        expect(() => prepare({ createdBy: 'invalid-id' as TEntityId })).toThrow(
          'ledger_error_created_by_invalid'
        );
      });

      it('retains accounting entity ID validation', () => {
        const id = 'invalid-id' as TEntityId;
        expect(() =>
          prepare({
            accountingEntity: { ...accountingEntity, id },
            controlAccount: { ...parent, accountingEntityId: id },
          })
        ).toThrow('ledger_error_ledger_account_accounting_entity_id_invalid');
      });

      it('retains currency validation', () => {
        expect(() =>
          prepare({
            currency: {
              ...SYSTEM_CURRENCIES.NGN,
              code: 'INVALID',
            } as unknown as ICurrency,
          })
        ).toThrow();
      });
    }
  );

  it('rejects invalid bank details', async () => {
    const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
    const [accountingEntity] = accountingEntityEntity.make({
      name: 'Test business',
      type: 'individual',
      ownerId: actorId,
      createdBy: actorId,
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    });
    const [controlAccount] = await service.createHeader(
      { name: 'Cash', accountingEntity, createdBy: actorId },
      mockOptions
    );
    expect(() =>
      service.createBankSubAccount({
        name: 'Bank',
        accountingEntity,
        controlAccount,
        createdBy: actorId,
        currency: SYSTEM_CURRENCIES.NGN,
        isControlAccount: false,
        bankDetails: {
          countryCode: 'NG',
          bankName: '',
          accountName: 'Main account',
          accountNumber: '0123456789',
        },
      })
    ).toThrow('ledger_error_ledger_account_bank_name_invalid');
  });
});
