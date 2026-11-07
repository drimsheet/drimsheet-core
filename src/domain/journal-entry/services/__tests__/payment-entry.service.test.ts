import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import makePaymentEntryService from '@domain/journal-entry/services/payment-entry.service';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ICreatePaymentEntryPayload } from '@domain/journal-entry/types/payment-entry.service.types';
import getLedgerAccountNormalBalanceHelper from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
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

const mockLedgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
  findAllByAccountingEntityId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustBalance: jest.fn(),
  findByAccountId: jest.fn(),
  findAdjustmentsByAccountId: jest.fn(),
  createWithAdjustments: jest.fn(),
  findAllByAccountIds: jest.fn(),
};

describe('paymentEntryService', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'payment-entry-service-test',
  };
  const service = makePaymentEntryService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  });

  function makePaymentAccount(
    overrides: Partial<ILedgerAccount>
  ): ILedgerAccount {
    const type = overrides.type ?? ELedgerType.Asset;
    const code = overrides.code ?? '100001';
    const [account] = ledgerAccountEntity.make({
      code,
      materializedPath: code,
      accountingEntityId: overrides.accountingEntityId ?? generateUUID(),
      type,
      subType: overrides.subType ?? EAssetSubType.CashAndCashEquivalent,
      behavior: overrides.behavior ?? EAssetAccountBehavior.Bank,
      normalBalance: getLedgerAccountNormalBalanceHelper(type),
      isControlAccount: false,
      controlAccountId: null,
      name: overrides.name ?? 'Payment account',
      currency: SYSTEM_CURRENCIES.NGN,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      meta: {},
      createdBy: generateUUID(),
      ...overrides,
    });

    return account;
  }

  function makeSourceAccountBalance(
    ledgerAccountId: TEntityId,
    accountingEntityId: TEntityId,
    currency: ICurrency,
    amount: bigint
  ) {
    const balance = ledgerAccountBalanceEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId,
      accountingEntityId,
      accountMaterializedPath: '100001',
      currencyCode: currency.code,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    });

    return ledgerAccountBalanceEntity.adjust(balance, {
      ledgerAccountId,
      amount: moneyValue.make(amount, currency, true),
      functionalAmount: moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true),
      journalEntryId: generateUUID(),
      createdBy: generateUUID(),
    }).newBalance;
  }

  function makePaymentFixture(postedAt: Date | null = null) {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'payment@example.com',
      emailVerified: true,
      firstName: 'Payment',
      lastName: 'Maker',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Payment LLC',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: user.id,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [counterparty] = counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: accountingEntity.id,
      name: 'Payment Vendor',
      type: ECounterpartyType.Organization,
    });
    const sourceAccount = makePaymentAccount({
      accountingEntityId: accountingEntity.id,
      createdBy: user.actorId,
      code: '100001',
    });
    const rentAccount = makePaymentAccount({
      accountingEntityId: accountingEntity.id,
      behavior: EExpenseAccountBehavior.RentAndUtilities,
      code: '502001',
      createdBy: user.actorId,
      subType: EExpenseSubType.RentAndUtilities,
      type: ELedgerType.Expense,
    });
    const payableAccount = makePaymentAccount({
      accountingEntityId: accountingEntity.id,
      code: '201001',
      createdBy: user.actorId,
      subType: 'payable',
      type: ELedgerType.Liability,
    });

    const payload: ICreatePaymentEntryPayload = {
      attachments: [
        {
          url: 'https://files.example.com/payment.pdf',
          name: 'payment.pdf',
          type: 'application/pdf',
          size: 1024,
        },
      ],
      header: {
        accountingEntityId: accountingEntity.id,
        memo: 'Vendor payment',
        effectiveDate,
        postedAt,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        createdBy: user.actorId,
      },
      sourceLine: {
        account: sourceAccount,
        counterparty,
        sequenceOrder: 1,
        amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: 'Bank payment',
        meta: null,
      },
      destinationLines: [
        {
          account: rentAccount,
          counterparty,
          sequenceOrder: 2,
          amount: moneyValue.make(7_000n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          description: 'Rent expense',
          meta: null,
        },
        {
          account: payableAccount,
          counterparty,
          sequenceOrder: 3,
          amount: moneyValue.make(3_000n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          description: 'Payable settlement',
          meta: null,
        },
      ],
    };

    return {
      accountingEntity,
      counterparty,
      payableAccount,
      payload,
      rentAccount,
      sourceAccount,
    };
  }

  function makeForexPaymentFixture(postedAt: Date | null = null) {
    const fixture = makePaymentFixture(postedAt);
    const exchangeRate = exchangeRateValue.make({
      baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
      targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      rate: 1600,
      type: EExchangeRateType.Official,
      asOf: effectiveDate,
      source: 'Test Source',
    });
    const sourceAccount = {
      ...fixture.sourceAccount,
      currency: SYSTEM_CURRENCIES.USD,
    };

    fixture.payload.sourceLine = {
      ...fixture.payload.sourceLine,
      account: sourceAccount,
      amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
      exchangeRate,
    };
    fixture.payload.destinationLines = [
      {
        ...fixture.payload.destinationLines[0],
        amount: moneyValue.make(112_000n, SYSTEM_CURRENCIES.NGN, true),
      },
      {
        ...fixture.payload.destinationLines[1],
        amount: moneyValue.make(48_000n, SYSTEM_CURRENCIES.NGN, true),
      },
    ];

    return { ...fixture, sourceAccount };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
    jest.clearAllMocks();
    mockLedgerAccountBalanceRepo.findByAccountId.mockImplementation(
      async (ledgerAccountId, accountingEntityId) =>
        makeSourceAccountBalance(
          ledgerAccountId,
          accountingEntityId,
          SYSTEM_CURRENCIES.NGN,
          1_000_000n
        )
    );
    mockAccountingPeriodService.validatePostingPeriod.mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('creates a draft payment with mapped lines, events, and audits', async () => {
      const { payload, sourceAccount, rentAccount, payableAccount } =
        makePaymentFixture();

      const [entry, events, audit] = await service.create(payload, repoOptions);

      expect(entry).toEqual(
        expect.objectContaining({
          accountingEntityId: payload.header.accountingEntityId,
          sourceType: EJournalEntrySourceType.Payment,
          status: EJournalEntryStatus.Draft,
          postedAt: null,
        })
      );
      expect(entry.lines).toEqual([
        expect.objectContaining({
          accountId: sourceAccount.id,
          side: EJournalSide.Credit,
          sequenceOrder: 1,
        }),
        expect.objectContaining({
          accountId: rentAccount.id,
          side: EJournalSide.Debit,
          sequenceOrder: 2,
        }),
        expect.objectContaining({
          accountId: payableAccount.id,
          side: EJournalSide.Debit,
          sequenceOrder: 3,
        }),
      ]);
      expect(entry.attachments).toEqual(payload.attachments);
      expect(events.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
      ]);
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit?.lines).toHaveLength(3);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenCalledWith(
        payload.header.accountingEntityId,
        payload.header.effectiveDate,
        repoOptions
      );
    });

    it('creates a posted payment when a posting date is provided', async () => {
      const { payload } = makePaymentFixture(timestamp);

      const [entry] = await service.create(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(entry.postedAt).toBe(timestamp);
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('creates a posted payment from an un-denominated source account without reading its balance', async () => {
      const { payload } = makePaymentFixture(timestamp);
      payload.sourceLine = {
        ...payload.sourceLine,
        account: { ...payload.sourceLine.account, currency: null },
      };

      const [entry] = await service.create(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('creates a draft FOREX payment without reading the source account balance', async () => {
      const { payload } = makeForexPaymentFixture();

      const [entry] = await service.create(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Draft);
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('creates a posted FOREX payment when the source amount equals the source account balance', async () => {
      const { payload } = makeForexPaymentFixture(timestamp);
      const sourceAccountBalance = makeSourceAccountBalance(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        SYSTEM_CURRENCIES.USD,
        100n
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
        sourceAccountBalance
      );

      await expect(service.create(payload, repoOptions)).resolves.toEqual(
        expect.any(Array)
      );
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        repoOptions
      );
    });

    it('rejects a posted FOREX payment larger than the source account balance before period validation', async () => {
      const { payload } = makeForexPaymentFixture(timestamp);
      const sourceAccountBalance = makeSourceAccountBalance(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        SYSTEM_CURRENCIES.USD,
        99n
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
        sourceAccountBalance
      );

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InsufficientSourceAccountBalance
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a posted FOREX payment with a missing source account balance before period validation', async () => {
      const { payload } = makeForexPaymentFixture(timestamp);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(null);

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.MissingSourceAccountBalance
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a non-permitted source account before period validation', async () => {
      const { payload, rentAccount } = makePaymentFixture();
      payload.sourceLine = { ...payload.sourceLine, account: rentAccount };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidSourceType
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a non-permitted destination account', async () => {
      const { payload, sourceAccount } = makePaymentFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        account: sourceAccount,
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('rejects an unbalanced payment', async () => {
      const { payload } = makePaymentFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(6_999n, SYSTEM_CURRENCIES.NGN, true),
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.UnbalancedJournalEntry
      );
    });

    it.each([false, true])(
      'rejects archived accounts when creating a payment (posted: %s)',
      async (posted) => {
        const postedAt = posted ? effectiveDate : null;
        const { payload } = makePaymentFixture(postedAt);
        payload.sourceLine.account = ledgerAccountEntity.archive(
          payload.sourceLine.account
        )[0];

        await expect(
          service.create(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    it('permits draft counterparties only before posting a payment', async () => {
      const { payload } = makePaymentFixture();
      const [draft] = counterpartyEntity.make({
        accountingEntityId: payload.header.accountingEntityId,
        createdBy: payload.header.createdBy,
        name: 'Draft counterparty',
        type: 'organization',
        status: 'draft',
      });
      payload.destinationLines[0].counterparty = draft;
      await expect(service.create(payload, repoOptions)).resolves.toBeDefined();
      payload.header.postedAt = effectiveDate;
      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DraftCounterpartyNotAllowed
      );
    });

    it.each(['source', 'destination'] as const)(
      'permits a draft %s account only before posting a payment',
      async (side) => {
        const { payload } = makePaymentFixture();
        const line =
          side === 'source' ? payload.sourceLine : payload.destinationLines[0];
        line.account = ledgerAccountEntity.make({
          ...line.account,
          status: ELedgerAccountStatus.Draft,
          controlAccountId: generateUUID(),
        })[0];
        const [entry] = await service.create(payload, repoOptions);
        expect(entry.status).toBe(EJournalEntryStatus.Draft);
        expect(entry.postedAt).toBeNull();
        payload.header.postedAt = effectiveDate;
        await expect(service.create(payload, repoOptions)).rejects.toThrow(
          journalEntryError.DraftLedgerAccountNotAllowed
        );
      }
    );
  });

  describe('postDraft', () => {
    async function fixture(forex = false) {
      const payment = forex ? makeForexPaymentFixture() : makePaymentFixture();
      const [entry] = await service.create(payment.payload, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();
      return {
        entry,
        accounts: [
          payment.sourceAccount,
          payment.rentAccount,
          payment.payableAccount,
        ],
        counterparties: [payment.counterparty],
        actor: payment.payload.header.createdBy,
      };
    }

    it('posts the existing draft while preserving dates, lines, attachments and attribution', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: [...payload.entry.lines].reverse(),
      };
      payload.accounts.reverse();
      const {
        journalEntry: [entry, events, audit],
        sourceAccount,
      } = await service.postDraft(payload, repoOptions);
      expect(entry).toEqual({
        ...payload.entry,
        status: 'posted',
        postedAt: timestamp,
        updatedAt: timestamp,
        version: payload.entry.version + 1,
      });
      expect(entry.lines).toEqual(payload.entry.lines);
      expect(Object.isFrozen(entry)).toBe(true);
      expect(sourceAccount.id).toBe(
        payload.entry.lines.find((line) => line.side === 'credit')!.accountId
      );
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EJournalEntryEvent.Updated);
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Updated);
      expect(audit?.lines).toEqual([]);
      expect(payload.entry.status).toBe('draft');
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenCalledWith(
        entry.accountingEntityId,
        effectiveDate,
        repoOptions
      );
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it.each(['posted', 'archived', 'voided'] as const)(
      'rejects a %s entry',
      async (status) => {
        const payload = await fixture();
        payload.entry = { ...payload.entry, status };
        await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
          journalEntryError.RectificationNotPermitted
        );
      }
    );

    it.each(['receipt', 'opening_balance', 'transfer'] as const)(
      'rejects a %s source',
      async (sourceType) => {
        const payload = await fixture();
        payload.entry = { ...payload.entry, sourceType };
        await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
          journalEntryError.RectificationNotPermitted
        );
      }
    );

    it('rejects an inconsistent already-posted draft', async () => {
      const payload = await fixture();
      payload.entry = { ...payload.entry, postedAt: timestamp };
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.RectificationNotPermitted
      );
    });

    it.each([0, 1])('rejects a missing account on side %s', async (index) => {
      const payload = await fixture();
      payload.accounts.splice(index, 1);
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.AccountNotFound
      );
    });

    it('rejects missing referenced counterparties', async () => {
      const payload = await fixture();
      await expect(
        service.postDraft({ ...payload, counterparties: [null] }, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidCounterpartyId);
    });

    it.each(['draft', 'archived'] as const)(
      'rejects a %s account on either side',
      async (status) => {
        for (const index of [0, 1]) {
          const payload = await fixture();
          const account = payload.accounts[index];
          payload.accounts[index] = ledgerAccountEntity.make({
            ...account,
            status,
          })[0];
          // Retain the persisted identity while changing current eligibility.
          payload.accounts[index] = {
            ...payload.accounts[index],
            id: account.id,
          };
          await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
            status === 'draft'
              ? journalEntryError.DraftLedgerAccountNotAllowed
              : journalEntryError.ArchivedLedgerAccountNotAllowed
          );
        }
      }
    );

    it('rejects a draft counterparty', async () => {
      const payload = await fixture();
      const counterparty = counterpartyEntity.make({
        ...payload.counterparties[0],
        status: 'draft',
      })[0];
      payload.counterparties = [
        { ...counterparty, id: payload.counterparties[0].id },
      ];
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DraftCounterpartyNotAllowed
      );
    });

    it('rejects counterparties owned by another accounting entity', async () => {
      const payload = await fixture();
      payload.counterparties = [
        { ...payload.counterparties[0], accountingEntityId: generateUUID() },
      ];
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidCounterpartyId
      );
    });

    it('rejects invalid source and destination account rules', async () => {
      for (const index of [0, 1]) {
        const payload = await fixture();
        const replacement =
          index === 0 ? payload.accounts[1] : payload.accounts[0];
        payload.accounts[index] = {
          ...replacement,
          id: payload.accounts[index].id,
        };
        await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
          index === 0
            ? journalEntryError.InvalidSourceType
            : journalEntryError.InvalidDestinationAccount
        );
      }
    });

    it('requires exactly one credit source line', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: payload.entry.lines.map((line) => ({ ...line, side: 'credit' })),
      };
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidSourceType
      );
    });

    it('accepts optional counterparties and a variable-currency source without an FX balance read', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: payload.entry.lines.map((line) => ({
          ...line,
          counterpartyId: null,
        })),
      };
      payload.accounts[0] = { ...payload.accounts[0], currency: null };
      await expect(
        service.postDraft({ ...payload, counterparties: [] }, repoOptions)
      ).resolves.toBeDefined();
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it.each([null, 50n, 100n])(
      'checks current FX source balance %s',
      async (amount) => {
        const payload = await fixture(true);
        const source = payload.accounts[0];
        mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(
          amount === null
            ? null
            : makeSourceAccountBalance(
                source.id,
                source.accountingEntityId,
                SYSTEM_CURRENCIES.USD,
                amount
              )
        );
        const posting = service.postDraft(payload, repoOptions);
        if (amount === 100n) {
          const {
            journalEntry: [entry],
          } = await posting;
          expect(entry.lines).toEqual(payload.entry.lines);
        } else {
          await expect(posting).rejects.toThrow(
            amount === null
              ? journalEntryError.MissingSourceAccountBalance
              : journalEntryError.InsufficientSourceAccountBalance
          );
        }
        expect(
          mockLedgerAccountBalanceRepo.findByAccountId
        ).toHaveBeenCalledWith(
          source.id,
          payload.entry.accountingEntityId,
          repoOptions
        );
      }
    );

    it('propagates a closed effective-period rejection', async () => {
      const payload = await fixture();
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
