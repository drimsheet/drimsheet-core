import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

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
const bankRepo: jest.Mocked<IBankAccountRepo> = {
  findOne: jest.fn(),
  findByLedgerAccountId: jest.fn(),
  create: jest.fn(),
};
const allocation: jest.Mocked<ILedgerCodeAllocationService> = {
  getNextCode: jest.fn(),
};
describe('cashAccountService', () => {
  const service = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: bankRepo,
    ledgerCodeAllocationService: allocation,
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
  describe('bank creation under the caller transaction', () => {
    const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
    const options = { correlationId: 'bank', tx: {} };
    let accountingEntity: IAccountingEntity;
    let parent: ILedgerAccount;
    const bankDetails = {
      countryCode: 'NG',
      bankName: ' Test Bank ',
      accountName: ' Main Account ',
      accountNumber: ' 0123456789 ',
    };
    beforeEach(async () => {
      [accountingEntity] = accountingEntityEntity.make({
        name: 'Business',
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
      mockLedgerAccountRepo.findByCode.mockResolvedValue(parent);
      mockLedgerAccountRepo.findById.mockResolvedValue(parent);
      bankRepo.findOne.mockResolvedValue(null);
      allocation.getNextCode.mockResolvedValue('100042');
      jest.clearAllMocks();
    });
    const payload = () => ({
      name: 'Operating Bank',
      accountingEntity,
      createdBy: actorId,
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      bankDetails,
    });
    it.each([undefined, new Date('2026-03-01T00:00:00Z')])(
      'creates complete version 1 state, events, and audit (date: %s)',
      async (openingBalanceDate) => {
        const [account, events, audit] = await service.createBankSubAccount(
          { ...payload(), openingBalanceDate },
          options
        );
        expect(account).toMatchObject({
          code: '100042',
          materializedPath: '100000.100042',
          controlAccountId: parent.id,
          openingBalanceDate: openingBalanceDate ?? null,
          version: 1,
          meta: {
            bankName: 'Test Bank',
            accountName: 'Main Account',
            accountNumber: '0123456789',
            countryCode: 'NG',
          },
        });
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual(account);
        expect(audit.diff).toMatchObject({ before: null, after: account });
        expect(Object.isFrozen(account)).toBe(true);
        expect(bankRepo.findOne).toHaveBeenCalledWith(
          'Test Bank',
          '0123456789',
          options
        );
        expect(allocation.getNextCode).toHaveBeenCalledWith(
          {
            accountingEntityId: accountingEntity.id,
            type: 'asset',
            subType: 'cash_and_cash_equivalent',
            allocationHeaderCode: '100000',
          },
          options
        );
        expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
        expect(bankRepo.create).not.toHaveBeenCalled();
      }
    );
    it('locks the shared header and explicit parent before selecting a code', async () => {
      const [nested] = ledgerAccountEntity.make({
        ...parent,
        code: '100010',
        materializedPath: '100000.100010',
        controlAccountId: parent.id,
        behavior: 'bank',
      });
      mockLedgerAccountRepo.findById.mockResolvedValue(nested);
      const [account] = await service.createBankSubAccount(
        { ...payload(), controlAccountId: nested.id },
        options
      );
      expect(account.materializedPath).toBe('100000.100010.100042');
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        nested.id,
        accountingEntity.id,
        { ...options, lock: ERepoLock.Update }
      );
      expect(
        mockLedgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(allocation.getNextCode.mock.invocationCallOrder[0]);
    });
    it('rejects duplicate normalized details before allocation', async () => {
      bankRepo.findOne.mockResolvedValue(bankDetails);
      await expect(
        service.createBankSubAccount(payload(), options)
      ).rejects.toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('requires a transaction before any reads', async () => {
      await expect(
        // @ts-expect-error Exercise untyped caller behavior.
        service.createBankSubAccount(payload(), mockOptions)
      ).rejects.toBeInstanceOf(
        ledgerAccountError.BankCreationTransactionRequired
      );
      expect(bankRepo.findOne).not.toHaveBeenCalled();
    });
    it('rejects a missing explicit parent with a domain 404 error', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      await expect(
        service.createBankSubAccount(
          { ...payload(), controlAccountId: parent.id },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
    });
    it('rejects a missing default parent', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
      await expect(
        service.createBankSubAccount(payload(), options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
    });
    it.each([
      { type: ELedgerType.Liability },
      { subType: EAssetSubType.Receivables },
      { isControlAccount: false },
      { behavior: EAssetAccountBehavior.PettyCash },
      { accountingEntityId: generateUUID() },
    ])('rejects invalid parents: %o', async (invalid) => {
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...parent,
        ...invalid,
      });
      await expect(
        service.createBankSubAccount(
          { ...payload(), controlAccountId: parent.id },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.InvalidControlAccount);
    });
    it('permits foreign currency under the default cash header', async () => {
      const [account] = await service.createBankSubAccount(
        { ...payload(), currency: SYSTEM_CURRENCIES.USD },
        options
      );
      expect(account.currency).toEqual(SYSTEM_CURRENCIES.USD);
    });
    it('rejects currency mismatch under a nested parent', async () => {
      const [nested] = ledgerAccountEntity.make({
        ...parent,
        code: '100010',
        materializedPath: '100000.100010',
        controlAccountId: parent.id,
        behavior: 'bank',
      });
      mockLedgerAccountRepo.findById.mockResolvedValue(nested);
      await expect(
        service.createBankSubAccount(
          {
            ...payload(),
            currency: SYSTEM_CURRENCIES.USD,
            controlAccountId: nested.id,
          },
          options
        )
      ).rejects.toBeInstanceOf(
        ledgerAccountError.ControlAccountCurrencyMismatch
      );
    });
    it('rejects invalid bank details before repository reads', async () => {
      await expect(
        service.createBankSubAccount(
          { ...payload(), bankDetails: { ...bankDetails, bankName: '' } },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.InvalidBankName);
      expect(bankRepo.findOne).not.toHaveBeenCalled();
    });
    it.each([new Date('2027-01-01'), new Date('invalid')])(
      'rejects an invalid opening date: %s',
      async (openingBalanceDate) => {
        await expect(
          service.createBankSubAccount(
            { ...payload(), openingBalanceDate },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.InvalidOpeningBalanceDate);
      }
    );
    it('rejects control-account opening dates', async () => {
      await expect(
        service.createBankSubAccount(
          {
            ...payload(),
            isControlAccount: true,
            openingBalanceDate: new Date('2026-03-01'),
          },
          options
        )
      ).rejects.toBeInstanceOf(
        ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate
      );
    });
    it.each(['duplicate', 'allocation', 'parent'] as const)(
      'propagates %s read failures without persistence',
      async (stage) => {
        const failure = new Error('database unavailable');
        if (stage === 'duplicate') bankRepo.findOne.mockRejectedValue(failure);
        if (stage === 'allocation')
          allocation.getNextCode.mockRejectedValue(failure);
        if (stage === 'parent')
          mockLedgerAccountRepo.findByCode.mockRejectedValue(failure);
        await expect(
          service.createBankSubAccount(payload(), options)
        ).rejects.toBe(failure);
        expect(bankRepo.create).not.toHaveBeenCalled();
      }
    );
  });
  describe('createPettyCashSubAccount protected creation', () => {
    const createdBy = generateUUID();
    const accountingEntity = {
      id: generateUUID(),
      createdBy,
      ownerId: createdBy,
      functionalCurrencyCode: 'USD',
    } as IAccountingEntity;
    const options = { correlationId: 'protected-creation', tx: {} };
    let header: ILedgerAccount;
    const payload: Parameters<typeof service.createPettyCashSubAccount>[0] = {
      name: 'Final account',
      createdBy,
      isControlAccount: false,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
    };
    beforeEach(async () => {
      mockLedgerAccountRepo.findByCode.mockReset().mockResolvedValue(null);
      header = (
        await service.createHeader(
          { name: 'Root account', accountingEntity, createdBy },
          options
        )
      )[0];
      jest.clearAllMocks();
      mockLedgerAccountRepo.findByCode.mockResolvedValue(header);
      mockLedgerAccountRepo.findById.mockResolvedValue(header);
      allocation.getNextCode
        .mockReset()
        .mockResolvedValue(header.code.slice(0, 3) + '042');
    });
    it('uses the established default parent and creates the final version 1 state once', async () => {
      const [account, events, audit] = await service.createPettyCashSubAccount(
        payload,
        options
      );
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(account).toMatchObject({
        code: header.code.slice(0, 3) + '042',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '042',
        controlAccountId: header.id,
        version: 1,
      });
      expect(account.currency).toBe(SYSTEM_CURRENCIES.USD);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(account);
      expect(audit.diff).toMatchObject({ before: null, after: account });
      expect(Object.isFrozen(account)).toBe(true);
      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
    it('locks the common root before a nested explicit parent and keeps the selected path', async () => {
      const parent = ledgerAccountEntity.make<ILedgerAccount>({
        ...header,
        name: 'Nested parent',
        code: header.code.slice(0, 3) + '037',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '037',
        controlAccountId: header.id,
        currency: SYSTEM_CURRENCIES.USD,
      })[0];
      mockLedgerAccountRepo.findById.mockResolvedValue(parent);
      const [account] = await service.createPettyCashSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        parent.id,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(
        mockLedgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(allocation.getNextCode.mock.invocationCallOrder[0]);
      expect(account.materializedPath).toBe(
        parent.materializedPath + '.' + account.code
      );
      expect(account.code).toBe(header.code.slice(0, 3) + '042');
    });
    it('rejects missing transaction context before any reads', async () => {
      await expect(
        service.createPettyCashSubAccount(payload, {
          correlationId: 'missing',
          tx: undefined,
        } as unknown as typeof options)
      ).rejects.toBeInstanceOf(
        ledgerAccountError.CodeAllocationTransactionRequired
      );
      expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    });
    it('rejects a missing allocation root before parent resolution', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
      await expect(
        service.createPettyCashSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createPettyCashSubAccount(
          { ...payload, controlAccountId: createdBy },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('propagates allocation failure without creating or storing state', async () => {
      const failure = new ledgerAccountError.MaximumLimitReached();
      allocation.getNextCode.mockRejectedValueOnce(failure);
      await expect(
        service.createPettyCashSubAccount(payload, options)
      ).rejects.toBe(failure);
      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('initializes the opening date in its single creation audit', async () => {
      const openingBalanceDate = new Date('2026-01-01T00:00:00Z');
      const [account, events, audit] = await service.createPettyCashSubAccount(
        { ...payload, openingBalanceDate },
        options
      );
      expect(account.openingBalanceDate).toEqual(openingBalanceDate);
      expect(account.version).toBe(1);
      expect(events).toHaveLength(1);
      expect(audit.diff.after.openingBalanceDate).toEqual(openingBalanceDate);
    });
    it.each([new Date('2030-01-01'), new Date('invalid')])(
      'rejects an invalid initial date %s',
      async (openingBalanceDate) => {
        await expect(
          service.createPettyCashSubAccount(
            { ...payload, openingBalanceDate },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.InvalidOpeningBalanceDate);
      }
    );
    it('forbids an opening date on a control account', async () => {
      await expect(
        service.createPettyCashSubAccount(
          {
            ...payload,
            isControlAccount: true,
            openingBalanceDate: new Date('2026-01-01'),
          },
          options
        )
      ).rejects.toBeInstanceOf(
        ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate
      );
    });
  });
});
