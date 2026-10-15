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
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  delete: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findDescendants: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};
const bankRepo: jest.Mocked<IBankAccountRepo> = {
  findOne: jest.fn(),
  findByLedgerAccountId: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
};
const allocation: jest.Mocked<ILedgerAccountService> = {
  canDelete: jest.fn(),
  canUpdateCurrency: jest.fn(),
  validateCurrencyChange: jest.fn(),
  delete: jest.fn(),
  archive: jest.fn(),
  getNextCode: jest.fn(),
  promotePostingToControlAccount: jest.fn(),
};
describe('cashAccountService', () => {
  const service = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: bankRepo,
    ledgerAccountService: allocation,
  });
  const mockOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T00:00:00.000Z'));
    jest.resetAllMocks();
    allocation.validateCurrencyChange.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  describe('activate', () => {
    const makeAccount = (overrides: Partial<ILedgerAccount> = {}) =>
      ledgerAccountEntity.make<ILedgerAccount>({
        code: '100001',
        materializedPath: '100000.100001',
        accountingEntityId: generateUUID(),
        createdBy: generateUUID(),
        name: 'Draft cash',
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
        behavior: EAssetAccountBehavior.PettyCash,
        normalBalance: 'debit',
        isControlAccount: false,
        controlAccountId: generateUUID(),
        currency: SYSTEM_CURRENCIES.NGN,
        status: ELedgerAccountStatus.Draft,
        meta: null,
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        ...overrides,
      })[0];

    beforeEach(() => {
      mockLedgerAccountRepo.findById.mockResolvedValue(
        makeAccount({
          status: ELedgerAccountStatus.Active,
          isControlAccount: true,
        })
      );
    });

    it.each(
      [
        EAssetAccountBehavior.PettyCash,
        EAssetAccountBehavior.Bank,
        EAssetAccountBehavior.DefaultCash,
      ].flatMap((behavior) =>
        [false, true].map((isControlAccount) => ({
          behavior,
          isControlAccount,
        }))
      )
    )(
      'activates $behavior, control=$isControlAccount with one immutable update and audit',
      async ({ behavior, isControlAccount }) => {
        const account = makeAccount({
          behavior,
          isControlAccount,
          openingBalanceDate: isControlAccount ? null : new Date('2026-01-01'),
          meta:
            behavior === EAssetAccountBehavior.Bank
              ? {
                  countryCode: 'NG',
                  bankName: 'Test Bank',
                  accountName: 'Cash',
                  accountNumber: '0123456789',
                }
              : null,
        });
        const [activated, events, audit] = await service.activate(
          account,
          mockOptions
        );

        expect(activated).toEqual({
          ...account,
          status: ELedgerAccountStatus.Active,
          version: 2,
        });
        expect(account.status).toBe(ELedgerAccountStatus.Draft);
        expect(Object.isFrozen(activated)).toBe(true);
        expect(Object.isFrozen(activated.currency)).toBe(true);
        if (activated.meta) {
          expect(Object.isFrozen(activated.meta)).toBe(true);
        }
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'domain:ledger:account:updated',
          data: activated,
        });
        expect(audit).toMatchObject({
          entityId: account.id,
          entityVersion: 2,
          action: 'updated',
          diff: { before: { status: 'draft' }, after: { status: 'active' } },
        });
        expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
          account.controlAccountId,
          account.accountingEntityId,
          mockOptions
        );
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
        expect(bankRepo.update).not.toHaveBeenCalled();
      }
    );

    it('returns an active cash account unchanged', async () => {
      const account = makeAccount({ status: ELedgerAccountStatus.Active });
      const [unchanged, events, audit] = await service.activate(
        account,
        mockOptions
      );
      expect(unchanged).toBe(account);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it.each([ELedgerAccountStatus.Archived])(
      'rejects %s accounts',
      async (status) => {
        await expect(
          service.activate(makeAccount({ status }), mockOptions)
        ).rejects.toBeInstanceOf(ledgerAccountError.InvalidStatus);
      }
    );

    it.each([
      { type: ELedgerType.Liability },
      { subType: EAssetSubType.Receivables },
    ])('rejects other account families: %o', async (overrides) => {
      await expect(
        service.activate(makeAccount(overrides), mockOptions)
      ).rejects.toBeInstanceOf(ledgerAccountError.InvalidBehavior);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });

    it('rejects an account without a parent', async () => {
      await expect(
        service.activate(makeAccount({ controlAccountId: null }), mockOptions)
      ).rejects.toBeInstanceOf(ledgerAccountError.InvalidControlAccountId);
    });

    it('rejects a missing parent', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      await expect(
        service.activate(makeAccount(), mockOptions)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
    });

    it.each([
      [
        ELedgerAccountStatus.Draft,
        ledgerAccountError.NonDraftChildOfDraftControlAccount,
      ],
      [
        ELedgerAccountStatus.Archived,
        ledgerAccountError.ArchivedControlAccount,
      ],
    ] as const)('rejects a %s parent', async (status, error) => {
      mockLedgerAccountRepo.findById.mockResolvedValue(
        makeAccount({ status, isControlAccount: true })
      );
      await expect(
        service.activate(makeAccount(), mockOptions)
      ).rejects.toBeInstanceOf(error);
    });
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
    it.each(
      [
        undefined,
        ELedgerAccountStatus.Active,
        ELedgerAccountStatus.Draft,
      ].flatMap((status) =>
        [false, true].map((isControlAccount) => ({ status, isControlAccount }))
      )
    )(
      'enforces draft-parent status for child $status, control=$isControlAccount',
      async ({ status, isControlAccount }) => {
        const [draftParent] = ledgerAccountEntity.make<ILedgerAccount>({
          ...parent,
          code: parent.code.slice(0, 3) + '037',
          materializedPath:
            parent.materializedPath + '.' + parent.code.slice(0, 3) + '037',
          controlAccountId: parent.id,
          status: ELedgerAccountStatus.Draft,
          currency: payload().currency,
        });
        mockLedgerAccountRepo.findById.mockResolvedValue(draftParent);
        const creation = service.createBankSubAccount(
          {
            ...payload(),
            controlAccountId: draftParent.id,
            status,
            isControlAccount,
          },
          options
        );
        if (status === ELedgerAccountStatus.Draft) {
          const [child] = await creation;
          expect(child).toMatchObject({
            status: ELedgerAccountStatus.Draft,
            controlAccountId: draftParent.id,
            isControlAccount,
          });
        } else {
          await expect(creation).rejects.toBeInstanceOf(
            ledgerAccountError.NonDraftChildOfDraftControlAccount
          );
          expect(allocation.getNextCode).not.toHaveBeenCalled();
        }
        expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
      }
    );

    it.each([true, false])(
      'rejects an archived parent with explicit selection %s before allocating a code',
      async (explicit) => {
        const [archivedParent] = ledgerAccountEntity.archive(parent);
        mockLedgerAccountRepo.findByCode.mockResolvedValue(
          explicit ? parent : archivedParent
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(archivedParent);

        await expect(
          service.createBankSubAccount(
            {
              ...payload(),
              controlAccountId: explicit ? archivedParent.id : undefined,
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
        expect(allocation.getNextCode).not.toHaveBeenCalled();
      }
    );

    it.each(
      [
        undefined,
        ELedgerAccountStatus.Active,
        ELedgerAccountStatus.Draft,
      ].flatMap((status) =>
        [undefined, new Date('2026-03-01T00:00:00Z')].map(
          (openingBalanceDate) => ({ status, openingBalanceDate })
        )
      )
    )(
      'creates complete version 1 state, events, and audit ($status, $openingBalanceDate)',
      async ({ status, openingBalanceDate }) => {
        const [account, events, audit] = await service.createBankSubAccount(
          { ...payload(), openingBalanceDate, status },
          options
        );
        expect(account).toMatchObject({
          code: '100042',
          materializedPath: '100000.100042',
          controlAccountId: parent.id,
          openingBalanceDate: openingBalanceDate ?? null,
          status: status ?? ELedgerAccountStatus.Active,
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
    describe('bank updates', () => {
      it('rejects a missing account before validating the update', async () => {
        mockLedgerAccountRepo.findById.mockResolvedValue(null);
        await expect(
          service.updateBankSubAccount(
            {
              id: parent.id,
              accountingEntityId: accountingEntity.id,
              name: 'Updated',
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.AccountNotFound);
        expect(allocation.validateCurrencyChange).not.toHaveBeenCalled();
      });

      it('requires a transaction before acquiring currency-edit locks', async () => {
        await expect(
          service.updateBankSubAccount(
            {
              id: parent.id,
              accountingEntityId: accountingEntity.id,
              currency: SYSTEM_CURRENCIES.NGN,
            },
            mockOptions
          )
        ).rejects.toThrow(ledgerAccountError.CurrencyChangeTransactionRequired);
        expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      });

      it('validates changed currency before returning an audited bank update', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        jest.clearAllMocks();
        const updatedResult = await service.updateBankSubAccount(
          {
            id: account.id,
            accountingEntityId: account.accountingEntityId,
            currency: SYSTEM_CURRENCIES.USD,
          },
          options
        );
        const [updated] = updatedResult;
        expect(allocation.validateCurrencyChange).toHaveBeenCalledWith(
          account,
          SYSTEM_CURRENCIES.USD,
          options
        );
        expect(updated.currency).toBe(SYSTEM_CURRENCIES.USD);
        expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
          ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
          account.accountingEntityId,
          { ...options, lock: ERepoLock.Update }
        );
        expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
          account.id,
          account.accountingEntityId,
          { ...options, lock: ERepoLock.Update }
        );
        expect(
          mockLedgerAccountRepo.findByCode.mock.invocationCallOrder[0]
        ).toBeLessThan(
          mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
        );
        expect(
          mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
        ).toBeLessThan(
          allocation.validateCurrencyChange.mock.invocationCallOrder[0]
        );

        allocation.validateCurrencyChange.mockRejectedValue(
          new ledgerAccountError.CurrencyChangeHasJournalEntries()
        );
        await expect(
          service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              currency: SYSTEM_CURRENCIES.USD,
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.CurrencyChangeHasJournalEntries);
      });
      it.each(['active', 'draft'] as const)(
        'updates %s account details with audit and events, retaining identity',
        async (status) => {
          const [account] = await service.createBankSubAccount(
            { ...payload(), status },
            options
          );
          mockLedgerAccountRepo.findById.mockResolvedValue(account);
          const openingBalanceDate = new Date('2026-03-01');
          const updatedResult = await service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              name: ' Updated Bank ',
              openingBalanceDate,
            },
            options
          );
          const [updated, events, audit] = updatedResult;

          expect(updated).toMatchObject({
            id: account.id,
            name: 'Updated Bank',
            openingBalanceDate,
            version: 2,
            status,
            meta: account.meta,
            currency: account.currency,
            controlAccountId: account.controlAccountId,
          });
          expect(account.name).toBe('Operating Bank');
          expect(account.openingBalanceDate).toBeNull();
          expect(Object.isFrozen(updated)).toBe(true);
          expect(Object.isFrozen(updated.meta)).toBe(true);
          expect(events).toHaveLength(1);
          expect(events[0].data).toEqual(updated);
          expect(audit?.diff).toMatchObject({
            before: account,
            after: updated,
          });
          expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
        }
      );

      it('returns unchanged state without audit or events for a no-op', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        expect(
          await service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              name: account.name,
            },
            options
          )
        ).toEqual([account, [], null]);
      });

      it.each([
        { bankName: 'Other Bank' },
        { accountNumber: '9876543210' },
        { accountName: 'Changed owner' },
      ])('normalizes and audits bank details %j', async (changes) => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        jest.clearAllMocks();
        const details = {
          bankName: 'Test Bank',
          accountName: 'Main Account',
          accountNumber: '0123456789',
          ...changes,
        };
        const updatedResult = await service.updateBankSubAccount(
          {
            id: account.id,
            accountingEntityId: account.accountingEntityId,
            bankDetails: {
              ...details,
              accountName: ` ${details.accountName} `,
            },
          },
          options
        );
        const [updated, events, audit] = updatedResult;
        expect(updated.meta).toEqual({ ...details, countryCode: 'NG' });
        expect(account.meta).toEqual({
          bankName: 'Test Bank',
          accountName: 'Main Account',
          accountNumber: '0123456789',
          countryCode: 'NG',
        });
        expect(updated.version).toBe(account.version + 1);
        expect(events[0].data).toEqual(updated);
        expect(audit?.diff).toMatchObject({ before: account, after: updated });
        expect(Object.isFrozen(updated.meta)).toBe(true);
        if ('accountName' in changes) {
          expect(bankRepo.findOne).not.toHaveBeenCalled();
        } else {
          expect(bankRepo.findOne).toHaveBeenCalledWith(
            details.bankName,
            details.accountNumber,
            options
          );
        }
        expect(bankRepo.update).not.toHaveBeenCalled();
      });

      it('treats equivalent normalized bank details as a no-op without matching itself as a duplicate', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        jest.clearAllMocks();
        expect(
          await service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              bankDetails,
            },
            options
          )
        ).toEqual([account, [], null]);
        expect(bankRepo.findOne).not.toHaveBeenCalled();
      });

      it('rejects another account with the requested normalized identity', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        bankRepo.findOne.mockResolvedValue(bankDetails);
        await expect(
          service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              bankDetails: { ...bankDetails, bankName: ' Other Bank ' },
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
        expect(bankRepo.findOne).toHaveBeenLastCalledWith(
          'Other Bank',
          '0123456789',
          options
        );
      });

      it('validates bank details before checking uniqueness', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        jest.clearAllMocks();
        await expect(
          service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              bankDetails: { ...bankDetails, bankName: ' ' },
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.InvalidBankName);
        expect(bankRepo.findOne).not.toHaveBeenCalled();
      });

      it.each([
        { type: ELedgerType.Liability },
        { subType: EAssetSubType.Receivables },
        { behavior: EAssetAccountBehavior.PettyCash },
      ])('rejects a different account family %j', async (changes) => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        const [otherAccount] = ledgerAccountEntity.make({
          ...account,
          ...changes,
        });
        mockLedgerAccountRepo.findById.mockResolvedValue(otherAccount);
        await expect(
          service.updateBankSubAccount(
            {
              id: otherAccount.id,
              accountingEntityId: otherAccount.accountingEntityId,
              name: 'Changed',
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.InvalidBehavior);
      });

      it('rejects archived accounts', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        const [archived] = ledgerAccountEntity.archive(account);
        mockLedgerAccountRepo.findById.mockResolvedValue(archived);
        await expect(
          service.updateBankSubAccount(
            {
              id: archived.id,
              accountingEntityId: archived.accountingEntityId,
              name: 'Changed',
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.InvalidStatus);
      });

      it('validates editable details through the entity', async () => {
        const [account] = await service.createBankSubAccount(
          payload(),
          options
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(account);
        await expect(
          service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              name: ' ',
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.InvalidName);
        await expect(
          service.updateBankSubAccount(
            {
              id: account.id,
              accountingEntityId: account.accountingEntityId,
              openingBalanceDate: new Date('2030-01-01'),
            },
            options
          )
        ).rejects.toThrow(ledgerAccountError.InvalidOpeningBalanceDate);
      });
    });

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
        if (stage === 'duplicate') {
          bankRepo.findOne.mockRejectedValue(failure);
        }
        if (stage === 'allocation') {
          allocation.getNextCode.mockRejectedValue(failure);
        }
        if (stage === 'parent') {
          mockLedgerAccountRepo.findByCode.mockRejectedValue(failure);
        }
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
    it.each(
      [
        undefined,
        ELedgerAccountStatus.Active,
        ELedgerAccountStatus.Draft,
      ].flatMap((status) =>
        [false, true].map((isControlAccount) => ({ status, isControlAccount }))
      )
    )(
      'enforces draft-parent status for child $status, control=$isControlAccount',
      async ({ status, isControlAccount }) => {
        const [parent] = ledgerAccountEntity.make<ILedgerAccount>({
          ...header,
          code: header.code.slice(0, 3) + '037',
          materializedPath:
            header.materializedPath + '.' + header.code.slice(0, 3) + '037',
          controlAccountId: header.id,
          status: ELedgerAccountStatus.Draft,
          currency: payload.currency ?? null,
        });
        mockLedgerAccountRepo.findById.mockResolvedValue(parent);
        const creation = service.createPettyCashSubAccount(
          { ...payload, controlAccountId: parent.id, status, isControlAccount },
          options
        );
        if (status === ELedgerAccountStatus.Draft) {
          const [child] = await creation;
          expect(child).toMatchObject({
            status: ELedgerAccountStatus.Draft,
            controlAccountId: parent.id,
            isControlAccount,
          });
        } else {
          await expect(creation).rejects.toBeInstanceOf(
            ledgerAccountError.NonDraftChildOfDraftControlAccount
          );
          expect(allocation.getNextCode).not.toHaveBeenCalled();
        }
        expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
      }
    );

    it.each([true, false])(
      'rejects an archived parent with explicit selection %s before allocating a code',
      async (explicit) => {
        const [archivedParent] = ledgerAccountEntity.archive(header);
        mockLedgerAccountRepo.findByCode.mockResolvedValue(
          explicit ? header : archivedParent
        );
        mockLedgerAccountRepo.findById.mockResolvedValue(archivedParent);

        await expect(
          service.createPettyCashSubAccount(
            {
              ...payload,
              controlAccountId: explicit ? archivedParent.id : undefined,
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
        expect(allocation.getNextCode).not.toHaveBeenCalled();
      }
    );

    it.each([
      undefined,
      ELedgerAccountStatus.Active,
      ELedgerAccountStatus.Draft,
    ])(
      'creates complete account, event, and audit state with status %s',
      async (status) => {
        const [account, events, audit] =
          await service.createPettyCashSubAccount(
            { ...payload, status },
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
        expect(account.status).toBe(status ?? ELedgerAccountStatus.Active);
        expect(account.currency).toBe(SYSTEM_CURRENCIES.USD);
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual(account);
        expect(audit.diff).toMatchObject({ before: null, after: account });
        expect(Object.isFrozen(account)).toBe(true);
        expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      }
    );
    it('locks the common root before a nested explicit parent and keeps the selected path', async () => {
      const parent = ledgerAccountEntity.make<ILedgerAccount>({
        ...header,
        name: 'Nested parent',
        code: header.code.slice(0, 3) + '037',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '037',
        controlAccountId: header.id,
        currency: SYSTEM_CURRENCIES.USD,
        status: ELedgerAccountStatus.Draft,
      })[0];
      mockLedgerAccountRepo.findById.mockResolvedValue(parent);
      const [account] = await service.createPettyCashSubAccount(
        {
          ...payload,
          controlAccountId: parent.id,
          status: ELedgerAccountStatus.Draft,
          isControlAccount: true,
        },
        options
      );
      expect(account).toMatchObject({
        status: ELedgerAccountStatus.Draft,
        isControlAccount: true,
      });
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

    it('rejects a missing account before validating the update', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      await expect(
        service.updatePettyCashSubAccount(
          {
            id: header.id,
            accountingEntityId: accountingEntity.id,
            name: 'Updated',
          },
          options
        )
      ).rejects.toThrow(ledgerAccountError.AccountNotFound);
      expect(allocation.validateCurrencyChange).not.toHaveBeenCalled();
    });

    it('requires a transaction before acquiring currency-edit locks', async () => {
      await expect(
        service.updatePettyCashSubAccount(
          {
            id: header.id,
            accountingEntityId: accountingEntity.id,
            currency: SYSTEM_CURRENCIES.NGN,
          },
          mockOptions
        )
      ).rejects.toThrow(ledgerAccountError.CurrencyChangeTransactionRequired);
      expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });

    it('updates only a non-archived petty-cash account', async () => {
      const [account] = await service.createPettyCashSubAccount(
        payload,
        options
      );
      mockLedgerAccountRepo.findById.mockResolvedValue(account);
      const updatedResult = await service.updatePettyCashSubAccount(
        {
          id: account.id,
          accountingEntityId: account.accountingEntityId,
          name: 'Updated petty cash',
        },
        options
      );
      const [updated, events, audit] = updatedResult;

      jest.clearAllMocks();
      const withCurrencyResult = await service.updatePettyCashSubAccount(
        {
          id: account.id,
          accountingEntityId: account.accountingEntityId,
          currency: SYSTEM_CURRENCIES.NGN,
        },
        options
      );
      const [withCurrency] = withCurrencyResult;
      expect(withCurrency.currency).toBe(SYSTEM_CURRENCIES.NGN);
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
        account.accountingEntityId,
        { ...options, lock: ERepoLock.Update }
      );
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        account.id,
        account.accountingEntityId,
        { ...options, lock: ERepoLock.Update }
      );
      expect(
        mockLedgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(
        allocation.validateCurrencyChange.mock.invocationCallOrder[0]
      );

      expect(allocation.validateCurrencyChange).toHaveBeenCalledWith(
        account,
        SYSTEM_CURRENCIES.NGN,
        options
      );
      allocation.validateCurrencyChange.mockRejectedValue(
        new ledgerAccountError.CurrencyChangeHasJournalEntries()
      );
      await expect(
        service.updatePettyCashSubAccount(
          {
            id: account.id,
            accountingEntityId: account.accountingEntityId,
            currency: SYSTEM_CURRENCIES.NGN,
          },
          options
        )
      ).rejects.toThrow(ledgerAccountError.CurrencyChangeHasJournalEntries);

      expect(updated).toMatchObject({
        id: account.id,
        name: 'Updated petty cash',
        version: 2,
      });
      expect(events).toHaveLength(1);
      expect(audit?.diff.before).toEqual(account);

      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        behavior: EAssetAccountBehavior.Bank,
      });
      await expect(
        service.updatePettyCashSubAccount(
          {
            id: account.id,
            accountingEntityId: account.accountingEntityId,
            name: 'Wrong family',
          },
          options
        )
      ).rejects.toThrow(ledgerAccountError.InvalidBehavior);
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        status: ELedgerAccountStatus.Archived,
      });
      await expect(
        service.updatePettyCashSubAccount(
          {
            id: account.id,
            accountingEntityId: account.accountingEntityId,
            name: 'Archived',
          },
          options
        )
      ).rejects.toThrow(ledgerAccountError.InvalidStatus);
    });
  });
});
