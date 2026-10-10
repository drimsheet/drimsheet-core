import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import makeOpeningBalanceEntryAppService from '@app/journal-entry/services/opening-balance-entry.service';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';

describe('opening balance entry app service creation', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'opening-balance-service-test',
  };
  const service = makeOpeningBalanceEntryAppService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    journalEntryQueryRepo: mockJournalEntryQueryRepo,
    fxLotAppService: mockFxLotAppService,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  const equityAccountService = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  type JournalPayload = Parameters<
    IOpeningBalanceEntryAppService['createInitialOpeningBalance']
  >[0];
  function toAppPayload(
    payload: JournalPayload
  ): Parameters<IOpeningBalanceEntryAppService['create']>[0] {
    const accountingEntity = accountingEntityEntity.make({
      name: 'Opening balance entity',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: payload.createdBy,
      createdBy: payload.createdBy,
      functionalCurrencyCode: currencyEntity.getByCode(
        payload.functionalCurrencyCode
      ).code,
      jurisdictionCode: 'NG',
    })[0];
    return {
      account: payload.account,
      accountingEntity: { ...accountingEntity, id: payload.accountingEntityId },
      actor: payload.createdBy,
      openingBalance: {
        amount: {
          amount: Number(payload.amount.amount),
          currencyCode: payload.amount.currency.code,
          isMinorUnit: true,
        },
        date: payload.effectiveDate,
        exchangeRate: payload.exchangeRate
          ? {
              baseCurrencyCode: payload.exchangeRate.baseCurrencyCode,
              targetCurrencyCode: payload.exchangeRate.targetCurrencyCode,
              rate: payload.exchangeRate.rate,
              type: payload.exchangeRate.type,
              asOf: payload.exchangeRate.asOf,
              source: payload.exchangeRate.source,
            }
          : null,
      },
    };
  }
  async function createOpeningBalance(
    payload: JournalPayload,
    options: IReadRepoOptions
  ) {
    const creation = await service.create(toAppPayload(payload), options);
    return creation.creation;
  }
  async function reviseOpeningBalance(
    payload: JournalPayload & {
      originalEntry: import('@domain/journal-entry/types/journal-entry.types').IJournalEntry;
    },
    options: IReadRepoOptions
  ) {
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [
        {
          ...payload.originalEntry,
          lines: payload.originalEntry.lines.map((line) => ({
            ...line,
            account: { id: line.accountId, name: 'Account' },
            counterparty: null,
          })),
        },
      ],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    const revision = await service.createOrRevise(
      toAppPayload(payload),
      options
    );
    const update = revision.mutation.entryUpdate!;
    return [
      update.entry,
      revision.mutation.events,
      { header: update.headerAudit, lines: update.lineAudits },
    ] as const;
  }
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
    jest.resetAllMocks();
    mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
      []
    );
    mockJournalEntryQueryRepo.existsPostedByAccountId.mockResolvedValue(false);
    mockFxLotAppService.acquire.mockResolvedValue(null);
  });
  afterEach(() => jest.useRealTimers());
  describe('createOpeningBalance', () => {
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
        const payload: Parameters<typeof createOpeningBalance>[0] =
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
          createOpeningBalance(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    describe('initial opening balance for a newly created dated account', () => {
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
          const [entry, events, audit] =
            await service.createInitialOpeningBalance(
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
            createOpeningBalance(payload, transactionOptions)
          ).rejects.toBeInstanceOf(journalEntryError.ExistingOpeningBalance);
        }
      );
      it.each([
        new periodError.PostingDateNotCovered(),
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
            service.createInitialOpeningBalance(payload, transactionOptions)
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
          service.createInitialOpeningBalance(payload, repoOptions)
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
            service.createInitialOpeningBalance(
              { ...payload, account },
              transactionOptions
            )
          ).rejects.toBeInstanceOf(journalEntryError.InvalidOpeningBalanceDate);
        }
      );
      it('rejects an already-persisted account', async () => {
        const payload = await initialPayload();
        mockLedgerAccountRepo.findById.mockResolvedValue(payload.account);
        await expect(
          service.createInitialOpeningBalance(payload, transactionOptions)
        ).rejects.toBeInstanceOf(
          journalEntryError.InitialOpeningBalanceAccountAlreadyExists
        );
      });
      it('rejects control accounts', async () => {
        const payload = await initialPayload();
        await expect(
          service.createInitialOpeningBalance(
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
          service.createInitialOpeningBalance(payload, transactionOptions)
        ).rejects.toBeInstanceOf(journalEntryError.ExistingOpeningBalance);
      });
      it('retains equity configuration protection', async () => {
        const payload = await initialPayload();
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([]);
        await expect(
          service.createInitialOpeningBalance(payload, transactionOptions)
        ).rejects.toBeInstanceOf(
          journalEntryError.UnConfiguredOpeningBalanceAccount
        );
      });
      it('propagates account lookup failure', async () => {
        const payload = await initialPayload();
        const failure = new Error('database unavailable');
        mockLedgerAccountRepo.findById.mockRejectedValue(failure);
        await expect(
          service.createInitialOpeningBalance(payload, transactionOptions)
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
      const [originalEntry] = await service.createInitialOpeningBalance(
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

      const [revisedEntry, events, audit] = await reviseOpeningBalance(
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
      expect(audit.header.diff.before).toMatchObject(originalEntry);
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

      const [entry, events, audit] = await createOpeningBalance(
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
        const [entry] = await service.createInitialOpeningBalance(
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
        createOpeningBalance(
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
        createOpeningBalance(
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
        createOpeningBalance(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.ExistingOpeningBalance);
      expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    });

    it('rejects when the opening balance equity account is not configured', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([]);

      await expect(
        createOpeningBalance(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.UnConfiguredOpeningBalanceAccount);
    });

    it('rejects a configured account that violates the opening balance destination rule', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.postingAccount,
      ]);

      await expect(
        createOpeningBalance(makeOpeningBalancePayload(fixture), repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects an opening-balance account belonging to another accounting entity', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      await expect(
        createOpeningBalance(
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
        createOpeningBalance(
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
        createOpeningBalance(
          { ...makeOpeningBalancePayload(fixture), exchangeRate },
          repoOptions
        )
      ).rejects.toThrow(journalLineError.UnsupportedExchangeRate);
    });
  });
});
