import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { TCashLedgerCode } from '@domain/ledger/types/ledger-code.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  findByCodeForUpdate: jest.fn(),
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
    jest.clearAllMocks();
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

  describe('createPettyCashSubAccount', () => {
    const ownerId = generateUUID();
    const entityId = generateUUID();
    const controlAccountId = generateUUID();
    const latestAccountId = generateUUID();

    const validAccountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: entityId,
      ownerId,
    } as IAccountingEntity;

    const validCurrency: ICurrency = {
      code: 'USD',
      name: 'US Dollar',
      minorUnit: 2,
      symbol: '$',
    };

    const mockControlAccount = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: controlAccountId,
      code: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      materializedPath: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.DefaultCash,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.EUR,
    } as ILedgerAccount;

    const mockLatestAccount = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: latestAccountId,
      code: '100001' as TCashLedgerCode,
      materializedPath:
        `${ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER}.100001` as TCashLedgerCode,
    } as ILedgerAccount;

    const validPayload = {
      name: 'Main Petty Cash',
      currency: validCurrency,
      isControlAccount: false,
      createdBy: ownerId,
      accountingEntity: validAccountingEntity,
      controlAccountCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
    };

    describe('when valid payload is provided', () => {
      it('permits a foreign-currency petty cash account under a header control account', async () => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
          mockControlAccount
        );
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(
          mockLatestAccount
        );

        const [account, events] = await service.createPettyCashSubAccount(
          validPayload,
          mockOptions
        );

        expect(account.name).toBe('Main Petty Cash');
        expect(account.accountingEntityId).toBe(entityId);
        expect(account.controlAccountId).toBe(controlAccountId);
        expect(account.currency).toEqual(validCurrency);
        expect(account.code).toBe('100002');
        expect(account.materializedPath).toBe(
          `${mockControlAccount.materializedPath}.100002`
        );
        expect(events.length).toBeGreaterThan(0);
        expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
          ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
          entityId,
          mockOptions
        );
      });

      it('should create a petty cash account successfully with an explicit control account code and no latest account', async () => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
          mockControlAccount
        );
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

        const [account, events] = await service.createPettyCashSubAccount(
          validPayload,
          mockOptions
        );

        expect(account.name).toBe('Main Petty Cash');
        expect(account.code).toBe('100001');
        expect(account.materializedPath).toBe(
          `${mockControlAccount.materializedPath}.100001`
        );
        expect(events.length).toBeGreaterThan(0);
        expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
          ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
          entityId,
          mockOptions
        );
      });
    });

    describe('Service Logic Validations', () => {
      it('should throw AppError if control account is not found', async () => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

        await expect(
          service.createPettyCashSubAccount(validPayload, mockOptions)
        ).rejects.toThrow();
      });

      it.each([
        { type: ELedgerType.Liability },
        { subType: EAssetSubType.Receivables },
        { isControlAccount: false },
      ])(
        'should reject an invalid repository-resolved control account: %o',
        async (invalidRole) => {
          mockLedgerAccountRepo.findByCode.mockResolvedValueOnce({
            ...mockControlAccount,
            ...invalidRole,
          });

          await expect(
            service.createPettyCashSubAccount(validPayload, mockOptions)
          ).rejects.toThrow(
            'ledger_error_asset_account_control_account_invalid'
          );
          expect(
            mockLedgerAccountRepo.findLatestBySubType
          ).not.toHaveBeenCalled();
        }
      );
    });

    describe('Payload Validations (Domain bubbling)', () => {
      beforeEach(() => {
        mockLedgerAccountRepo.findByCode.mockResolvedValue(mockControlAccount);
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue(
          mockLatestAccount
        );
      });

      it('should throw if name is invalid or empty', async () => {
        const payload = {
          ...validPayload,
          name: ' ',
        };

        await expect(
          service.createPettyCashSubAccount(payload, mockOptions)
        ).rejects.toThrow();
      });

      it('should throw if accountingEntityId is an invalid UUID', async () => {
        const payload = {
          ...validPayload,
          accountingEntity: {
            ...validAccountingEntity,
            id: 'invalid-uuid' as TEntityId,
          },
        };

        await expect(
          service.createPettyCashSubAccount(payload, mockOptions)
        ).rejects.toThrow();
      });

      it('should throw if createdBy contains an invalid user ID', async () => {
        const payload = {
          ...validPayload,
          createdBy: 'invalid-uuid' as TEntityId,
          accountingEntity: {
            ...validAccountingEntity,
            ownerId: 'invalid-uuid' as TEntityId,
          },
        };

        await expect(
          service.createPettyCashSubAccount(payload, mockOptions)
        ).rejects.toThrow();
      });

      it('should throw if currency code is invalid', async () => {
        const payload = {
          ...validPayload,
          currency: {
            ...validCurrency,
            code: 'INVALID',
          } as unknown as ICurrency,
        };

        await expect(
          service.createPettyCashSubAccount(payload, mockOptions)
        ).rejects.toThrow();
      });
    });
  });

  describe('createBankSubAccount', () => {
    const ownerId = generateUUID();
    const entityId = generateUUID();
    const controlAccountId = generateUUID();

    const validAccountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: entityId,
      ownerId,
    } as IAccountingEntity;

    const validCurrency: ICurrency = {
      code: 'USD',
      name: 'US Dollar',
      minorUnit: 2,
      symbol: '$',
    };

    const mockControlAccount = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: controlAccountId,
      code: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      materializedPath: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.DefaultCash,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.EUR,
    } as ILedgerAccount;

    const validBankValue = {
      countryCode: 'US',
      bankName: 'JPMorgan Chase',
      accountName: 'Operating Account',
      accountNumber: '1234567890',
    };

    const validBankPayload = {
      name: 'Chase Operating Account',
      currency: validCurrency,
      isControlAccount: false,
      createdBy: ownerId,
      accountingEntity: validAccountingEntity,
      controlAccountCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      bankDetails: validBankValue,
    };

    it.each([EAssetAccountBehavior.DefaultCash, EAssetAccountBehavior.Bank])(
      'creates a bank account under a %s control account',
      async (controlAccountBehavior) => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce({
          ...mockControlAccount,
          behavior: controlAccountBehavior,
        });
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

        const [account, events] = await service.createBankSubAccount(
          validBankPayload,
          mockOptions
        );

        expect(account.name).toBe('Chase Operating Account');
        expect(account.behavior).toBe('bank');
        expect(account.currency).toEqual(validCurrency);
        expect(account.meta).toEqual(validBankValue);
        expect(account.code).toBe('100001');
        expect(events.length).toBeGreaterThan(0);
      }
    );
  });
});
