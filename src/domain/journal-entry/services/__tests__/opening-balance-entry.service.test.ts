import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import makeOpeningBalanceEntryService from '@domain/journal-entry/services/opening-balance-entry.service';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

const mockAccountingPeriodService: jest.Mocked<IAccountingPeriodService> = {
  validatePostingPeriod: jest.fn(),
};

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
};

const mockLedgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  adjustBalance: jest.fn(),
  findByAccountId: jest.fn(),
  findAdjustmentsByAccountId: jest.fn(),
  createWithAdjustments: jest.fn(),
  findAllByAccountingEntityId: jest.fn(),
  findAllByAccountIds: jest.fn(),
};

const mockBankAccountRepo: jest.Mocked<IBankAccountRepo> = {
  findOne: jest.fn(),
  findByLedgerAccountId: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
};

const mockLedgerAccountService: jest.Mocked<ILedgerAccountService> = {
  canDelete: jest.fn(),
  canUpdateCurrency: jest.fn(),
  validateCurrencyChange: jest.fn(),
  delete: jest.fn(),
  archive: jest.fn(),
  getNextCode: jest.fn(),
  promotePostingToControlAccount: jest.fn(),
};

describe('openingBalanceEntryService', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'opening-balance-entry-service-test',
  };
  const service = makeOpeningBalanceEntryService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
  });
  const equityAccountService = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
    jest.resetAllMocks();
    mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
      []
    );
    mockAccountingPeriodService.validatePostingPeriod.mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    async function makeOpeningBalanceFixture(
      postingCurrency: ICurrency = SYSTEM_CURRENCIES.NGN
    ) {
      const [user] = userEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        email: 'opening.balance@example.com',
        emailVerified: true,
        firstName: 'Opening',
        lastName: 'Balance',
      });
      const [accountingEntity] = accountingEntityEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        name: 'Opening Balance LLC',
        type: EAccountingEntityType.PrivateCompany,
        ownerId: user.id,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        jurisdictionCode: 'NG',
      });
      const [controlAccount] = await cashAccountService.createHeader(
        {
          name: 'Cash and Cash Equivalents',
          accountingEntity,
          createdBy: user.actorId,
        },
        repoOptions
      );
      const [postingAccount] = ((
        payload: Omit<
          Parameters<typeof cashAccountService.createPettyCashSubAccount>[0],
          'controlAccountId'
        > & { controlAccount: ILedgerAccount }
      ) => {
        const controlAccount = payload.controlAccount;
        const code = String(Number(controlAccount.code) + 1).padStart(6, '0');
        const materializedPath = controlAccount.materializedPath + '.' + code;
        return ledgerAccountEntity.make<ILedgerAccount>({
          name: payload.name,
          accountingEntityId: payload.accountingEntity.id,
          code,
          materializedPath,
          normalBalance: 'debit',
          type: 'asset',
          subType: 'cash_and_cash_equivalent',
          behavior: 'petty_cash',
          isControlAccount: payload.isControlAccount,
          controlAccountId: controlAccount.id,
          currency: payload.currency,
          meta: null,
          status: 'active',
          contraAccountRule: 'contra_permitted',
          adjunctAccountRule: 'adjunct_permitted',
          createdBy: payload.createdBy,
        }) as Awaited<
          ReturnType<typeof cashAccountService.createPettyCashSubAccount>
        >;
      })({
        name: 'Main Petty Cash',
        currency: postingCurrency,
        isControlAccount: false,
        controlAccount,
        accountingEntity,
        createdBy: user.actorId,
      });
      const [equityAccount] =
        await equityAccountService.createOpeningBalanceAccount(
          {
            name: 'Opening Balance Equity',
            createdBy: user.actorId,
            accountingEntity,
          },
          repoOptions
        );

      return {
        accountingEntity,
        amount: moneyValue.make(125_000n, postingCurrency, true),
        controlAccount,
        equityAccount,
        postingAccount,
        user,
      };
    }

    function makeOpeningBalancePayload(
      fixture: Awaited<ReturnType<typeof makeOpeningBalanceFixture>>
    ) {
      return {
        accountingEntityId: fixture.accountingEntity.id,
        functionalCurrencyCode: fixture.accountingEntity.functionalCurrencyCode,
        account: fixture.postingAccount,
        amount: fixture.amount,
        effectiveDate: timestamp,
        exchangeRate: null,
        createdBy: fixture.user.actorId,
      };
    }

    it.each(['target', 'equity'] as const)(
      'rejects an archived %s account inside opening-balance creation',
      async (kind) => {
        const fixture = await makeOpeningBalanceFixture();
        const payload: Parameters<typeof service.create>[0] =
          makeOpeningBalancePayload(fixture);
        const equityAccount =
          kind === 'equity'
            ? ledgerAccountEntity.archive(fixture.equityAccount)[0]
            : fixture.equityAccount;
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([equityAccount]);
        if (kind === 'target') {
          payload.account = ledgerAccountEntity.archive(payload.account)[0];
        }

        await expect(
          service.create(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    describe('createInitial', () => {
      const transactionOptions = { ...repoOptions, tx: {} };
      async function initialPayload(status: 'active' | 'draft' = 'active') {
        const fixture = await makeOpeningBalanceFixture();
        const [account] = ledgerAccountEntity.make({
          ...fixture.postingAccount,
          status,
          openingBalanceDate: new Date(timestamp.getTime() - 1),
        });
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        mockLedgerAccountRepo.findById.mockResolvedValue(null);
        return { ...makeOpeningBalancePayload(fixture), account };
      }
      it.each(['active', 'draft'] as const)(
        'prepares the initial journal and audit for a %s account',
        async (status) => {
          const payload = await initialPayload(status);
          const [entry, events, audit] = await service.createInitial(
            payload,
            transactionOptions
          );
          expect(entry.status).toBe(
            status === 'draft'
              ? EJournalEntryStatus.Draft
              : EJournalEntryStatus.Posted
          );
          expect(entry.postedAt).toEqual(
            status === 'draft' ? null : payload.effectiveDate
          );
          expect(entry.effectiveDate).toEqual(payload.effectiveDate);
          expect(entry.lines[0].amount).toEqual(payload.amount);
          expect(events[0].data).toEqual(entry);
          expect(audit.header.diff.after).toMatchObject({
            status: entry.status,
            postedAt: entry.postedAt,
          });
          expect(entry.lines[0].accountId).toBe(payload.account.id);
          expect(
            mockAccountingPeriodService.validatePostingPeriod
          ).toHaveBeenCalledWith(
            payload.accountingEntityId,
            payload.effectiveDate,
            transactionOptions
          );
          expect(
            mockAccountingPeriodService.validatePostingPeriod.mock
              .invocationCallOrder[0]
          ).toBeLessThan(
            mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mock
              .invocationCallOrder[0]
          );
          expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
            payload.account.id,
            payload.account.accountingEntityId,
            transactionOptions
          );
          expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
          await expect(
            service.create(payload, transactionOptions)
          ).rejects.toBeInstanceOf(journalEntryError.ExistingOpeningBalance);
        }
      );
      it.each([
        new periodError.PostingDateNotCovered(),
        new periodError.PostingPeriodAmbiguous(),
        new periodError.PostingPeriodNotOpen(),
        new Error('Period lookup failed'),
      ])(
        'rejects before preparing the journal when period validation fails: %s',
        async (failure) => {
          const payload = await initialPayload();
          mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
            failure
          );

          await expect(
            service.createInitial(payload, transactionOptions)
          ).rejects.toBe(failure);
          expect(
            mockAccountingPeriodService.validatePostingPeriod
          ).toHaveBeenCalledWith(
            payload.accountingEntityId,
            payload.effectiveDate,
            transactionOptions
          );
          expect(
            mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId
          ).not.toHaveBeenCalled();
        }
      );
      it('requires a caller transaction', async () => {
        const payload = await initialPayload();
        await expect(
          // @ts-expect-error Exercise runtime guard.
          service.createInitial(payload, repoOptions)
        ).rejects.toBeInstanceOf(
          journalEntryError.InitialOpeningBalanceTransactionRequired
        );
      });
      it.each([null, new Date('2020-01-01')])(
        'rejects a missing or mismatched date: %s',
        async (openingBalanceDate) => {
          const payload = await initialPayload();
          const [account] = ledgerAccountEntity.make({
            ...payload.account,
            openingBalanceDate,
          });
          await expect(
            service.createInitial({ ...payload, account }, transactionOptions)
          ).rejects.toBeInstanceOf(journalEntryError.InvalidOpeningBalanceDate);
        }
      );
      it('rejects an already-persisted account', async () => {
        const payload = await initialPayload();
        mockLedgerAccountRepo.findById.mockResolvedValue(payload.account);
        await expect(
          service.createInitial(payload, transactionOptions)
        ).rejects.toBeInstanceOf(
          journalEntryError.InitialOpeningBalanceAccountAlreadyExists
        );
      });
      it('rejects control accounts', async () => {
        const payload = await initialPayload();
        await expect(
          service.createInitial(
            {
              ...payload,
              account: { ...payload.account, isControlAccount: true },
            },
            transactionOptions
          )
        ).rejects.toBeInstanceOf(
          journalEntryError.ControlAccountOpeningBalanceNotAllowed
        );
      });
      it('retains existing-adjustment protection', async () => {
        const payload = await initialPayload();
        mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValueOnce(
          [{}] as Awaited<
            ReturnType<ILedgerAccountBalanceRepo['findAdjustmentsByAccountId']>
          >
        );
        await expect(
          service.createInitial(payload, transactionOptions)
        ).rejects.toBeInstanceOf(journalEntryError.ExistingOpeningBalance);
      });
      it('retains equity configuration protection', async () => {
        const payload = await initialPayload();
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([]);
        await expect(
          service.createInitial(payload, transactionOptions)
        ).rejects.toBeInstanceOf(
          journalEntryError.UnConfiguredOpeningBalanceAccount
        );
      });
      it('propagates account lookup failure', async () => {
        const payload = await initialPayload();
        const failure = new Error('database unavailable');
        mockLedgerAccountRepo.findById.mockRejectedValue(failure);
        await expect(
          service.createInitial(payload, transactionOptions)
        ).rejects.toBe(failure);
      });
    });

    it('revises a draft opening balance with persisted IDs retained', async () => {
      const fixture = await makeOpeningBalanceFixture();
      const revisedDate = new Date('2026-08-02T00:00:00.000Z');
      const [draftAccount] = ledgerAccountEntity.make({
        ...fixture.postingAccount,
        status: ELedgerAccountStatus.Draft,
        openingBalanceDate: effectiveDate,
      });
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      const [originalEntry] = await service.createInitial(
        {
          ...makeOpeningBalancePayload(fixture),
          account: draftAccount,
          effectiveDate,
        },
        { ...repoOptions, tx: {} }
      );
      const revisedAmount = moneyValue.make(
        250_000n,
        SYSTEM_CURRENCIES.NGN,
        true
      );

      const [revisedEntry, events, audit] = await service.reviseDraft(
        {
          ...makeOpeningBalancePayload(fixture),
          account: draftAccount,
          amount: revisedAmount,
          effectiveDate: revisedDate,
          originalEntry,
        },
        repoOptions
      );

      expect(revisedEntry).toMatchObject({
        id: originalEntry.id,
        status: EJournalEntryStatus.Draft,
        postedAt: null,
        effectiveDate: revisedDate,
      });
      expect(revisedEntry.lines.map((line) => line.id)).toEqual(
        originalEntry.lines.map((line) => line.id)
      );
      expect(revisedEntry.lines[0].amount).toEqual(revisedAmount);
      expect(events).not.toHaveLength(0);
      expect(audit?.header.diff.before).toMatchObject(originalEntry);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenCalledWith(
        fixture.accountingEntity.id,
        revisedDate,
        repoOptions
      );
    });

    it('creates a posted opening balance with the configured equity account', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      const [entry, events, audit] = await service.create(
        makeOpeningBalancePayload(fixture),
        repoOptions
      );

      expect(entry).toEqual(
        expect.objectContaining({
          accountingEntityId: fixture.accountingEntity.id,
          sourceType: EJournalEntrySourceType.OpeningBalance,
          status: EJournalEntryStatus.Posted,
          effectiveDate: timestamp,
          postedAt: timestamp,
          memo: 'Opening balance',
          createdBy: fixture.user.actorId,
        })
      );
      expect(entry.lines).toEqual([
        expect.objectContaining({
          accountId: fixture.postingAccount.id,
          sequenceOrder: 1,
          amount: fixture.amount,
          side: EJournalSide.Debit,
          description: 'Opening balance',
        }),
        expect.objectContaining({
          accountId: fixture.equityAccount.id,
          sequenceOrder: 2,
          amount: fixture.amount,
          side: EJournalSide.Credit,
          description: 'Opening balance',
        }),
      ]);
      expect(events).toHaveLength(3);
      expect(audit.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(
        mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId
      ).toHaveBeenCalledWith(fixture.postingAccount.id, repoOptions);
      expect(mockLedgerAccountRepo.findBySubType).toHaveBeenCalledWith(
        fixture.accountingEntity.id,
        ELedgerType.Equity,
        EEquitySubType.OpeningBalance,
        repoOptions
      );
    });

    it.each(['active', 'draft'] as const)(
      'creates a balanced foreign opening with preserved exchange rate for %s',
      async (status) => {
        const fixture = await makeOpeningBalanceFixture(SYSTEM_CURRENCIES.USD);
        const [account] = ledgerAccountEntity.make({
          ...fixture.postingAccount,
          status,
          openingBalanceDate: new Date(timestamp.getTime() - 1),
        });
        const amount = moneyValue.make(100, SYSTEM_CURRENCIES.USD, false);
        const functionalAmount = moneyValue.make(
          135_000,
          SYSTEM_CURRENCIES.NGN,
          false
        );
        const exchangeRate = exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
          rate: 1350,
          type: EExchangeRateType.Market,
          asOf: new Date('2026-08-03T10:00:00.000Z'),
          source: 'Test Source',
        });
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);

        mockLedgerAccountRepo.findById.mockResolvedValue(null);
        const [entry] = await service.createInitial(
          {
            ...makeOpeningBalancePayload(fixture),
            account,
            amount,
            exchangeRate,
          },
          { ...repoOptions, tx: {} }
        );

        expect(entry.status).toBe(
          status === 'draft'
            ? EJournalEntryStatus.Draft
            : EJournalEntryStatus.Posted
        );
        expect(entry.postedAt).toEqual(status === 'draft' ? null : timestamp);
        expect(entry.lines).toEqual([
          expect.objectContaining({
            accountId: account.id,
            amount,
            functionalAmount,
            exchangeRate,
            side: EJournalSide.Debit,
          }),
          expect.objectContaining({
            accountId: fixture.equityAccount.id,
            amount: functionalAmount,
            functionalAmount,
            exchangeRate: null,
            side: EJournalSide.Credit,
          }),
        ]);
      }
    );

    it('rejects a control account before repository checks', async () => {
      const fixture = await makeOpeningBalanceFixture();

      await expect(
        service.create(
          {
            ...makeOpeningBalancePayload(fixture),
            account: fixture.controlAccount,
          },
          repoOptions
        )
      ).rejects.toThrow(
        journalEntryError.ControlAccountOpeningBalanceNotAllowed
      );
      expect(
        mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId
      ).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    });

    it('rejects an account with an existing opening balance date before repository checks', async () => {
      const fixture = await makeOpeningBalanceFixture();

      await expect(
        service.create(
          {
            ...makeOpeningBalancePayload(fixture),
            account: {
              ...fixture.postingAccount,
              openingBalanceDate: new Date('2026-08-01T00:00:00.000Z'),
            },
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.ExistingOpeningBalance);
      expect(
        mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId
      ).not.toHaveBeenCalled();
    });

    it('rejects an account with an existing balance adjustment', async () => {
      const fixture = await makeOpeningBalanceFixture();
      const balance = ledgerAccountBalanceEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: fixture.postingAccount.id,
        accountingEntityId: fixture.accountingEntity.id,
        accountMaterializedPath: fixture.postingAccount.materializedPath,
        currencyCode: SYSTEM_CURRENCIES.NGN.code,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      });
      const { adjustment } = ledgerAccountBalanceEntity.adjust(balance, {
        ledgerAccountId: fixture.postingAccount.id,
        amount: fixture.amount,
        functionalAmount: fixture.amount,
        journalEntryId: generateUUID(),
        createdBy: fixture.user.actorId,
      });
      mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
        [adjustment]
      );

      await expect(
        service.create(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.ExistingOpeningBalance);
      expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    });

    it('rejects when the opening balance equity account is not configured', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([]);

      await expect(
        service.create(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.UnConfiguredOpeningBalanceAccount);
    });

    it('rejects a configured account that violates the opening balance destination rule', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.postingAccount,
      ]);

      await expect(
        service.create(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects an opening-balance account belonging to another accounting entity', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      await expect(
        service.create(
          {
            ...makeOpeningBalancePayload(fixture),
            account: {
              ...fixture.postingAccount,
              accountingEntityId: generateUUID(),
            },
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.InvalidAccountingEntity);
    });

    it('rejects an opening-balance amount that differs from the fixed account currency', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      await expect(
        service.create(
          {
            ...makeOpeningBalancePayload(fixture),
            amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
          },
          repoOptions
        )
      ).rejects.toThrow(ledgerAccountError.OpeningBalanceCurrencyMismatch);
    });

    it('rejects same-currency opening balances with an exchange rate', async () => {
      const fixture = await makeOpeningBalanceFixture();
      const exchangeRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1,
        type: EExchangeRateType.Official,
        asOf: new Date('2026-08-03T10:00:00.000Z'),
        source: 'Test Source',
      });
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      await expect(
        service.create(
          { ...makeOpeningBalancePayload(fixture), exchangeRate },
          repoOptions
        )
      ).rejects.toThrow(journalLineError.UnsupportedExchangeRate);
    });
  });

  describe('postDraft', () => {
    function fixture(currency = SYSTEM_CURRENCIES.NGN) {
      const [draftAccount] = ledgerAccountEntity.make<ILedgerAccount>({
        name: 'Opening cash',
        code: '100001',
        materializedPath: '100000.100001',
        accountingEntityId: generateUUID(),
        createdBy: generateUUID(),
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'petty_cash',
        normalBalance: 'debit',
        isControlAccount: false,
        controlAccountId: generateUUID(),
        currency,
        status: 'draft',
        meta: null,
        openingBalanceDate: effectiveDate,
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
      });
      const [equity] = ledgerAccountEntity.make<ILedgerAccount>({
        ...draftAccount,
        name: 'Opening equity',
        code: '300001',
        materializedPath: '300000.300001',
        type: 'equity',
        subType: 'opening_balance',
        behavior: 'opening_balance_equity',
        status: 'active',
        currency: SYSTEM_CURRENCIES.NGN,
        normalBalance: 'credit',
        openingBalanceDate: null,
      });
      const exchangeRate =
        currency.code === 'NGN'
          ? null
          : exchangeRateValue.make({
              baseCurrencyCode: currency.code,
              targetCurrencyCode: 'NGN',
              rate: 1500,
              type: EExchangeRateType.Negotiated,
              asOf: effectiveDate,
              source: 'Test',
            });
      const amount = moneyValue.make(10000n, currency, true);
      const functionalAmount = exchangeRate
        ? moneyValue.convert(amount, exchangeRate, SYSTEM_CURRENCIES.NGN)
        : amount;
      const [entry] = journalEntryEntity.make({
        accountingEntityId: draftAccount.accountingEntityId,
        createdBy: draftAccount.createdBy,
        sourceType: 'opening_balance',
        effectiveDate,
        postedAt: null,
        memo: 'Opening balance',
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
        lines: [
          {
            accountId: draftAccount.id,
            amount,
            exchangeRate,
            side: 'debit',
            sequenceOrder: 1,
            description: 'Opening balance',
            functionalCurrency: SYSTEM_CURRENCIES.NGN,
          },
          {
            accountId: equity.id,
            amount: functionalAmount,
            exchangeRate: null,
            side: 'credit',
            sequenceOrder: 2,
            description: null,
            functionalCurrency: SYSTEM_CURRENCIES.NGN,
          },
        ],
      });
      const [account] = ledgerAccountEntity.activate(draftAccount);
      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([equity]);
      return { entry, account, draftAccount, equity, actor: generateUUID() };
    }

    it.each([SYSTEM_CURRENCIES.NGN, SYSTEM_CURRENCIES.USD])(
      'posts an existing $code opening journal at the current time while preserving its effective date, lines and valuation',
      async (currency) => {
        const payload = fixture(currency);
        const [posted, events, audit] = await service.postDraft(
          payload,
          repoOptions
        );

        expect(posted).toEqual({
          ...payload.entry,
          status: 'posted',
          postedAt: timestamp,
          version: payload.entry.version + 1,
          updatedAt: timestamp,
        });
        expect(posted.lines).toEqual(payload.entry.lines);
        expect(audit?.lines).toEqual([]);
        expect(audit?.header).toMatchObject({
          entityId: payload.entry.id,
          entityVersion: 2,
          diff: { before: { status: 'draft' }, after: { status: 'posted' } },
        });
        expect(events).toEqual([
          expect.objectContaining({
            type: EJournalEntryEvent.Updated,
            data: posted,
          }),
        ]);
        expect(Object.isFrozen(posted)).toBe(true);
        expect(payload.entry.status).toBe('draft');
        expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
          [payload.equity.id],
          payload.entry.accountingEntityId,
          repoOptions
        );
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenCalledWith(
          payload.entry.accountingEntityId,
          timestamp,
          repoOptions
        );
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      }
    );

    it('rejects an account that has not been prepared as active', async () => {
      const payload = fixture();
      await expect(
        service.postDraft(
          { ...payload, account: payload.draftAccount },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.DraftLedgerAccountNotAllowed);
    });

    it.each(['draft', 'archived'] as const)(
      'rejects a %s counterpart account',
      async (status) => {
        const payload = fixture();
        mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
          { ...payload.equity, status },
        ]);
        await expect(
          service.postDraft(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    it('rejects a missing counterpart', async () => {
      const payload = fixture();
      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([]);
      await expect(
        service.postDraft(payload, repoOptions)
      ).rejects.toBeInstanceOf(journalEntryError.AccountNotFound);
    });

    it('rejects a counterpart belonging to another accounting entity', async () => {
      const payload = fixture();
      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
        { ...payload.equity, accountingEntityId: generateUUID() },
      ]);
      await expect(
        service.postDraft(payload, repoOptions)
      ).rejects.toBeInstanceOf(journalEntryError.InvalidAccountingEntity);
    });

    it('rejects a non-opening journal', async () => {
      const payload = fixture();
      await expect(
        service.postDraft(
          { ...payload, entry: { ...payload.entry, sourceType: 'receipt' } },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.RectificationNotPermitted);
    });

    it('rejects a journal that is already posted', async () => {
      const payload = fixture();
      await expect(
        service.postDraft(
          {
            ...payload,
            entry: {
              ...payload.entry,
              status: 'posted',
              postedAt: effectiveDate,
            },
          },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.RectificationNotPermitted);
    });

    it('rejects a journal associated with another account', async () => {
      const payload = fixture();
      await expect(
        service.postDraft(
          { ...payload, account: { ...payload.account, id: generateUUID() } },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.RectificationNotPermitted);
    });

    it('rejects an opening date mismatch', async () => {
      const payload = fixture();
      await expect(
        service.postDraft(
          {
            ...payload,
            account: { ...payload.account, openingBalanceDate: null },
          },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.InvalidOpeningBalanceDate);
    });

    it('rejects a closed posting period', async () => {
      const payload = fixture();
      const failure = new periodError.PostingPeriodNotOpen();
      mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
        failure
      );
      await expect(service.postDraft(payload, repoOptions)).rejects.toBe(
        failure
      );
    });
  });
});
