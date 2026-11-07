import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import makeTransferEntryService from '@domain/journal-entry/services/transfer-entry.service';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ICreateTransferEntryPayload } from '@domain/journal-entry/types/transfer-entry.service.types';
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

describe('transferEntryService', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'transfer-entry-service-test',
  };
  const service = makeTransferEntryService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  });

  function makeTransferAccount(
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
      name: overrides.name ?? 'Transfer account',
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

  function makeTransferFixture(postedAt: Date | null = null) {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'transfer@example.com',
      emailVerified: true,
      firstName: 'Transfer',
      lastName: 'Maker',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Transfer LLC',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: user.id,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [bankCounterparty] = counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: accountingEntity.id,
      name: 'Transfer provider',
      type: ECounterpartyType.Organization,
    });
    const sourceAccount = makeTransferAccount({
      accountingEntityId: accountingEntity.id,
      behavior: EAssetAccountBehavior.Bank,
      code: '100001',
      createdBy: user.actorId,
      name: 'Operating bank',
    });
    const destinationAccount = makeTransferAccount({
      accountingEntityId: accountingEntity.id,
      behavior: 'petty_cash',
      code: '100002',
      createdBy: user.actorId,
      name: 'Petty cash',
    });
    const bankChargeAccount = makeTransferAccount({
      accountingEntityId: accountingEntity.id,
      behavior: EExpenseAccountBehavior.BankCharge,
      code: '507001',
      createdBy: user.actorId,
      name: 'Bank charges',
      subType: EExpenseSubType.BankCharge,
      type: ELedgerType.Expense,
    });
    const payload: ICreateTransferEntryPayload = {
      attachments: [
        {
          url: 'https://files.example.com/transfer.pdf',
          name: 'transfer.pdf',
          type: 'application/pdf',
          size: 1024,
        },
      ],
      header: {
        accountingEntityId: accountingEntity.id,
        memo: 'Cash transfer',
        effectiveDate,
        postedAt,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        createdBy: user.actorId,
      },
      sourceLine: {
        account: sourceAccount,
        sequenceOrder: 1,
        amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: 'Transfer from bank',
        meta: null,
      },
      destinationLines: [
        {
          account: destinationAccount,
          counterparty: null,
          sequenceOrder: 2,
          amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          description: 'Transfer to petty cash',
          meta: null,
        },
      ],
    };

    return {
      accountingEntity,
      bankCounterparty,
      bankChargeAccount,
      destinationAccount,
      payload,
      sourceAccount,
    };
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
    it('creates a draft transfer with mapped lines, attachments, events, and audits', async () => {
      const { destinationAccount, payload, sourceAccount } =
        makeTransferFixture();

      const {
        journalEntry: [entry, events, audit],
        destinationAssetAccount,
      } = await service.create(payload, repoOptions);

      expect(entry).toEqual(
        expect.objectContaining({
          accountingEntityId: payload.header.accountingEntityId,
          sourceType: EJournalEntrySourceType.Transfer,
          status: EJournalEntryStatus.Draft,
          postedAt: null,
        })
      );
      expect(entry.lines).toEqual([
        expect.objectContaining({
          accountId: sourceAccount.id,
          counterpartyId: null,
          side: EJournalSide.Credit,
          sequenceOrder: 1,
        }),
        expect.objectContaining({
          accountId: destinationAccount.id,
          counterpartyId: null,
          side: EJournalSide.Debit,
          sequenceOrder: 2,
        }),
      ]);
      expect(entry.attachments).toEqual(payload.attachments);
      expect(Object.isFrozen(entry.attachments)).toBe(true);
      expect(events.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
      ]);
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit?.lines).toHaveLength(2);
      expect(destinationAssetAccount).toBe(destinationAccount);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenCalledWith(
        payload.header.accountingEntityId,
        payload.header.effectiveDate,
        repoOptions
      );
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('creates a posted transfer when a posting date is provided', async () => {
      const { payload } = makeTransferFixture(timestamp);

      const {
        journalEntry: [entry],
      } = await service.create(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(entry.postedAt).toBe(timestamp);
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        repoOptions
      );
    });

    it('creates a transfer when the source amount equals the source account balance', async () => {
      const { payload } = makeTransferFixture(timestamp);
      const sourceAccountBalance = makeSourceAccountBalance(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        SYSTEM_CURRENCIES.NGN,
        10_000n
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
        sourceAccountBalance
      );

      await expect(service.create(payload, repoOptions)).resolves.toEqual(
        expect.objectContaining({ journalEntry: expect.any(Array) })
      );
    });

    it('rejects a transfer larger than the source account balance before period validation', async () => {
      const { payload } = makeTransferFixture(timestamp);
      const sourceAccountBalance = makeSourceAccountBalance(
        payload.sourceLine.account.id,
        payload.header.accountingEntityId,
        SYSTEM_CURRENCIES.NGN,
        9_999n
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

    it('rejects a transfer with a missing source account balance before period validation', async () => {
      const { payload } = makeTransferFixture(timestamp);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(null);

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.MissingSourceAccountBalance
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('creates one balanced transfer with a Bank Charge destination', async () => {
      const {
        bankChargeAccount,
        bankCounterparty,
        destinationAccount,
        payload,
      } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(9_500n, SYSTEM_CURRENCIES.NGN, true),
      };
      payload.destinationLines.push({
        account: bankChargeAccount,
        counterparty: bankCounterparty,
        sequenceOrder: 3,
        amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: 'Transfer fee',
        meta: null,
      });

      const {
        journalEntry: [entry],
        destinationAssetAccount,
      } = await service.create(payload, repoOptions);

      expect(entry.lines).toEqual([
        expect.objectContaining({
          accountId: payload.sourceLine.account.id,
          side: EJournalSide.Credit,
        }),
        expect.objectContaining({
          accountId: destinationAccount.id,
          side: EJournalSide.Debit,
        }),
        expect.objectContaining({
          accountId: bankChargeAccount.id,
          counterpartyId: bankCounterparty.id,
          side: EJournalSide.Debit,
        }),
      ]);
      expect(destinationAssetAccount).toBe(destinationAccount);
    });

    it('creates a balanced cross-currency transfer', async () => {
      const { payload } = makeTransferFixture();
      const exchangeRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1600,
        type: EExchangeRateType.Official,
        asOf: effectiveDate,
        source: 'Test Source',
      });
      payload.sourceLine = {
        ...payload.sourceLine,
        amount: moneyValue.make(160_000n, SYSTEM_CURRENCIES.NGN, true),
      };
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        account: {
          ...payload.destinationLines[0].account,
          currency: SYSTEM_CURRENCIES.USD,
        },
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
        exchangeRate,
      };

      const {
        journalEntry: [entry],
      } = await service.create(payload, repoOptions);

      expect(entry.lines).toHaveLength(2);
      expect(entry.lines[0].amount.currency).toBe(SYSTEM_CURRENCIES.NGN);
      expect(entry.lines[1].amount.currency).toBe(SYSTEM_CURRENCIES.USD);
      expect(entry.lines[0].exchangeRate).toBeNull();
      expect(entry.lines[1].exchangeRate).toBe(exchangeRate);
      expect(entry.lines[0].functionalAmount.amount).toBe(160_000n);
      expect(entry.lines[1].functionalAmount.amount).toBe(160_000n);
    });

    it('creates a balanced FX transfer with a Bank Charge before the asset destination', async () => {
      const {
        bankChargeAccount,
        bankCounterparty,
        destinationAccount,
        payload,
      } = makeTransferFixture(timestamp);
      const exchangeRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1600,
        type: EExchangeRateType.Official,
        asOf: effectiveDate,
        source: 'Test Source',
      });
      payload.sourceLine = {
        ...payload.sourceLine,
        account: {
          ...payload.sourceLine.account,
          currency: SYSTEM_CURRENCIES.USD,
        },
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
        exchangeRate,
      };
      payload.destinationLines = [
        {
          account: bankChargeAccount,
          counterparty: bankCounterparty,
          amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
          description: 'Transfer fee',
          exchangeRate: null,
          meta: null,
          sequenceOrder: 2,
        },
        {
          ...payload.destinationLines[0],
          amount: moneyValue.make(159_500n, SYSTEM_CURRENCIES.NGN, true),
          sequenceOrder: 3,
        },
      ];
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
        makeSourceAccountBalance(
          payload.sourceLine.account.id,
          payload.header.accountingEntityId,
          SYSTEM_CURRENCIES.USD,
          100n
        )
      );

      const {
        journalEntry: [entry, events, audit],
        destinationAssetAccount,
      } = await service.create(payload, repoOptions);

      expect(entry.lines).toHaveLength(3);
      expect(entry.lines[0].amount.currency).toBe(SYSTEM_CURRENCIES.USD);
      expect(entry.lines[0].exchangeRate).toBe(exchangeRate);
      expect(entry.lines[1].exchangeRate).toBeNull();
      expect(entry.lines[0].functionalAmount.amount).toBe(160_000n);
      expect(entry.lines[1]).toEqual(
        expect.objectContaining({
          accountId: bankChargeAccount.id,
          side: EJournalSide.Debit,
          sequenceOrder: 2,
        })
      );
      expect(entry.lines[2]).toEqual(
        expect.objectContaining({
          accountId: destinationAccount.id,
          side: EJournalSide.Debit,
          sequenceOrder: 3,
        })
      );
      expect(destinationAssetAccount).toBe(destinationAccount);
      expect(events.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
      ]);
      expect(audit?.lines).toHaveLength(3);
    });

    it('rejects duplicate transfer accounts before period validation', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        account: payload.sourceLine.account,
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DuplicateAccountsNotPermitted
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('rejects a non-cash source account before period validation', async () => {
      const { payload } = makeTransferFixture();
      payload.sourceLine = {
        ...payload.sourceLine,
        account: makeTransferAccount({
          accountingEntityId: payload.header.accountingEntityId,
          behavior: EExpenseAccountBehavior.RentAndUtilities,
          code: '502001',
          subType: EExpenseSubType.RentAndUtilities,
          type: ELedgerType.Expense,
        }),
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidSourceType
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('rejects a counterparty on the cash destination', async () => {
      const { bankCounterparty, payload } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        counterparty: bankCounterparty,
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.CounterpartyIdNotAllowed
      );
    });

    it('allows multiple Bank Charge lines to use the same expense account', async () => {
      const { bankChargeAccount, bankCounterparty, payload } =
        makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(9_500n, SYSTEM_CURRENCIES.NGN, true),
      };
      payload.destinationLines.push(
        {
          account: bankChargeAccount,
          counterparty: bankCounterparty,
          sequenceOrder: 3,
          amount: moneyValue.make(250n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          description: 'Provider fee',
          meta: null,
        },
        {
          account: bankChargeAccount,
          counterparty: bankCounterparty,
          sequenceOrder: 4,
          amount: moneyValue.make(250n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          description: 'Bank fee',
          meta: null,
        }
      );

      const {
        journalEntry: [entry],
      } = await service.create(payload, repoOptions);

      expect(
        entry.lines.filter((line) => line.accountId === bankChargeAccount.id)
      ).toHaveLength(2);
    });

    it('rejects a Bank Charge counterparty from another accounting entity', async () => {
      const { bankChargeAccount, bankCounterparty, payload } =
        makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(9_500n, SYSTEM_CURRENCIES.NGN, true),
      };
      payload.destinationLines.push({
        account: bankChargeAccount,
        counterparty: {
          ...bankCounterparty,
          accountingEntityId: generateUUID(),
        },
        sequenceOrder: 3,
        amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: 'Transfer fee',
        meta: null,
      });

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidCounterpartyId
      );
    });

    it('rejects a destination collection without a cash asset', async () => {
      const { bankChargeAccount, payload } = makeTransferFixture();
      payload.destinationLines = [
        {
          ...payload.destinationLines[0],
          account: bankChargeAccount,
        },
      ];

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('rejects a destination collection with multiple cash assets', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines.push({
        ...payload.destinationLines[0],
        account: makeTransferAccount({
          accountingEntityId: payload.header.accountingEntityId,
          code: '100003',
        }),
        sequenceOrder: 3,
      });

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('rejects an additional destination that is not a Bank Charge', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines.push({
        ...payload.destinationLines[0],
        account: makeTransferAccount({
          accountingEntityId: payload.header.accountingEntityId,
          behavior: EExpenseAccountBehavior.RentAndUtilities,
          code: '502001',
          subType: EExpenseSubType.RentAndUtilities,
          type: ELedgerType.Expense,
        }),
        sequenceOrder: 3,
      });

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('rejects an unbalanced transfer', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(9_999n, SYSTEM_CURRENCIES.NGN, true),
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.UnbalancedJournalEntry
      );
    });

    it.each([false, true])(
      'rejects archived accounts inside transfer creation (posted: %s)',
      async (posted) => {
        const postedAt = posted ? effectiveDate : null;
        const { payload, bankChargeAccount } = makeTransferFixture(postedAt);
        payload.destinationLines.push({
          ...payload.destinationLines[0],
          account: ledgerAccountEntity.archive(bankChargeAccount)[0],
          amount: moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true),
          sequenceOrder: 3,
        });

        await expect(
          service.create(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    it('permits draft counterparties only before posting a transfer', async () => {
      const { payload, bankChargeAccount } = makeTransferFixture();
      const [chargeCounterparty] = counterpartyEntity.make({
        accountingEntityId: payload.header.accountingEntityId,
        createdBy: payload.header.createdBy,
        name: 'Draft bank',
        type: 'organization',
        status: 'draft',
      });
      payload.destinationLines[0].amount = moneyValue.make(
        9500n,
        SYSTEM_CURRENCIES.NGN,
        true
      );
      payload.destinationLines.push({
        account: bankChargeAccount,
        counterparty: chargeCounterparty,
        amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
        sequenceOrder: 3,
        exchangeRate: null,
        description: 'Bank charge',
        meta: null,
      });
      await expect(service.create(payload, repoOptions)).resolves.toBeDefined();
      payload.header.postedAt = effectiveDate;
      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DraftCounterpartyNotAllowed
      );
    });

    it.each(['source', 'destination'] as const)(
      'permits draft accounts on the %s side only before posting a transfer',
      async (side) => {
        const { payload } = makeTransferFixture();
        const line =
          side === 'source' ? payload.sourceLine : payload.destinationLines[0];
        line.account = ledgerAccountEntity.make({
          ...line.account,
          status: ELedgerAccountStatus.Draft,
          controlAccountId: generateUUID(),
        })[0];
        const {
          journalEntry: [entry],
        } = await service.create(payload, repoOptions);
        expect(entry.status).toBe(EJournalEntryStatus.Draft);
        expect(entry.postedAt).toBeNull();
        payload.header.postedAt = effectiveDate;
        await expect(service.create(payload, repoOptions)).rejects.toThrow(
          journalEntryError.DraftLedgerAccountNotAllowed
        );
      }
    );
  });

  describe('voidAndReplace', () => {
    async function makeReplacementFixture(postedAt: Date | null = timestamp) {
      const { payload, bankChargeAccount, bankCounterparty } =
        makeTransferFixture(postedAt);
      const original = await service.create(payload, repoOptions);
      const [entry] = original.journalEntry;
      mockLedgerAccountBalanceRepo.findByAccountId.mockClear();
      mockAccountingPeriodService.validatePostingPeriod.mockClear();

      return {
        entry,
        voidingEntryId: generateUUID(),
        createdBy: generateUUID(),
        sourceLine: {
          ...payload.sourceLine,
          amount: moneyValue.make(9_000n, SYSTEM_CURRENCIES.NGN, true),
        },
        destinationLines: [
          {
            account: bankChargeAccount,
            counterparty: bankCounterparty,
            sequenceOrder: 2,
            amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
            exchangeRate: null,
            description: 'Transfer fee',
            meta: null,
          },
          {
            ...payload.destinationLines[0],
            sequenceOrder: 3,
            amount: moneyValue.make(8_500n, SYSTEM_CURRENCIES.NGN, true),
          },
        ],
      };
    }

    it('returns the audited void, posted replacement, and replacement destination asset', async () => {
      const payload = await makeReplacementFixture();
      const { entry } = payload;
      const replacementPostedAt = new Date('2026-08-05T10:00:00.000Z');
      jest.setSystemTime(replacementPostedAt);

      const { voided, replacement } = await service.voidAndReplace(
        payload,
        repoOptions
      );

      const [voidedEntry, voidEvents, voidAudit] = voided;
      expect(voidedEntry).toMatchObject({
        id: entry.id,
        status: EJournalEntryStatus.Voided,
        lines: entry.lines,
        voidingEntryId: payload.voidingEntryId,
      });
      expect(voidEvents.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Voided,
      ]);
      expect(voidAudit?.action).toBe(EJournalEntryAuditAction.Voided);
      expect(entry.status).toBe(EJournalEntryStatus.Posted);

      const replacementTransfer = replacement!;
      const [replacementEntry, replacementEvents, replacementAudit] =
        replacementTransfer.journalEntry;
      expect(replacementTransfer.destinationAssetAccount).toBe(
        payload.destinationLines[1].account
      );
      expect(replacementEntry.id).not.toBe(entry.id);
      expect(replacementEntry).toMatchObject({
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Transfer,
        status: EJournalEntryStatus.Posted,
        effectiveDate: entry.effectiveDate,
        postedAt: replacementPostedAt,
        memo: entry.memo,
        attachments: entry.attachments,
        createdBy: payload.createdBy,
        lines: [
          {
            accountId: payload.sourceLine.account.id,
            amount: payload.sourceLine.amount,
            side: EJournalSide.Credit,
          },
          ...payload.destinationLines.map((line) => ({
            accountId: line.account.id,
            amount: line.amount,
            side: EJournalSide.Debit,
          })),
        ],
      });
      expect(replacementEvents[0].type).toBe(EJournalEntryEvent.Created);
      expect(replacementAudit.header.action).toBe(
        EJournalEntryAuditAction.Created
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod.mock.calls
      ).toEqual([[entry.accountingEntityId, entry.effectiveDate, repoOptions]]);
    });

    it('returns the original voided transfer on retry with the same reversal', async () => {
      const payload = await makeReplacementFixture();
      const firstCorrection = await service.voidAndReplace(
        payload,
        repoOptions
      );
      const [entry] = firstCorrection.voided;
      mockLedgerAccountBalanceRepo.findByAccountId.mockClear();
      mockAccountingPeriodService.validatePostingPeriod.mockClear();

      const { voided, replacement } = await service.voidAndReplace(
        { ...payload, entry },
        repoOptions
      );

      expect(voided[0]).toBe(entry);
      expect(voided.slice(1)).toEqual([[], null]);
      expect(replacement).toBeNull();
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a draft transfer', async () => {
      const payload = await makeReplacementFixture(null);

      await expect(
        service.voidAndReplace(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidStatusTransition);
    });

    it('rejects a non-transfer entry', async () => {
      const payload = await makeReplacementFixture();
      const transfer = payload.entry;
      const functionalCurrency = SYSTEM_CURRENCIES.NGN;
      const [entry] = journalEntryEntity.make({
        accountingEntityId: transfer.accountingEntityId,
        effectiveDate: transfer.effectiveDate,
        postedAt: transfer.postedAt,
        memo: transfer.memo,
        createdBy: transfer.createdBy,
        sourceType: EJournalEntrySourceType.Adjustment,
        functionalCurrency,
        lines: transfer.lines.map((line) => ({ ...line, functionalCurrency })),
      });

      await expect(
        service.voidAndReplace({ ...payload, entry }, repoOptions)
      ).rejects.toThrow(journalEntryError.RectificationNotPermitted);
    });

    it('rejects a replacement when its source balance is insufficient', async () => {
      const payload = await makeReplacementFixture();
      const { account, amount } = payload.sourceLine;
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
        makeSourceAccountBalance(
          account.id,
          account.accountingEntityId,
          amount.currency,
          8_999n
        )
      );

      await expect(
        service.voidAndReplace(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InsufficientSourceAccountBalance);
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
        account.id,
        payload.entry.accountingEntityId,
        repoOptions
      );
      expect(payload.entry.status).toBe(EJournalEntryStatus.Posted);
    });

    it('rejects a replacement in a closed effective period', async () => {
      const payload = await makeReplacementFixture();
      const failure = new periodError.PostingPeriodNotOpen();
      mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
        failure
      );

      await expect(service.voidAndReplace(payload, repoOptions)).rejects.toBe(
        failure
      );
      expect(payload.entry.status).toBe(EJournalEntryStatus.Posted);
    });
  });

  describe('postDraft', () => {
    async function fixture(forex = false) {
      const transfer = makeTransferFixture();
      transfer.payload.destinationLines[0].amount = moneyValue.make(
        9_500n,
        SYSTEM_CURRENCIES.NGN,
        true
      );
      transfer.payload.destinationLines.push({
        account: transfer.bankChargeAccount,
        counterparty: transfer.bankCounterparty,
        sequenceOrder: 3,
        amount: moneyValue.make(500n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: 'Transfer fee',
        meta: null,
      });
      if (forex) {
        transfer.sourceAccount = {
          ...transfer.sourceAccount,
          currency: SYSTEM_CURRENCIES.USD,
        };
        transfer.payload.sourceLine = {
          ...transfer.payload.sourceLine,
          account: transfer.sourceAccount,
          amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
          exchangeRate: exchangeRateValue.make({
            baseCurrencyCode: 'USD',
            targetCurrencyCode: 'NGN',
            rate: 100,
            type: EExchangeRateType.Official,
            asOf: effectiveDate,
            source: 'Test',
          }),
        };
      }
      const {
        journalEntry: [entry],
      } = await service.create(transfer.payload, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();
      return {
        entry,
        accounts: [
          transfer.sourceAccount,
          transfer.destinationAccount,
          transfer.bankChargeAccount,
        ],
        counterparties: [transfer.bankCounterparty],
        actor: transfer.payload.header.createdBy,
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
        destinationAssetAccount,
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
      expect(destinationAssetAccount.id).toBe(
        payload.accounts.find((account) => account.behavior === 'petty_cash')!
          .id
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
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalled();
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

    it.each(['receipt', 'opening_balance', 'payment'] as const)(
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

    it.each([0, 1, 2])(
      'rejects a missing account on side %s',
      async (index) => {
        const payload = await fixture();
        payload.accounts.splice(index, 1);
        await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
          journalEntryError.AccountNotFound
        );
      }
    );

    it('rejects missing referenced counterparties', async () => {
      const payload = await fixture();
      await expect(
        service.postDraft({ ...payload, counterparties: [null] }, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidCounterpartyId);
    });

    it.each(['draft', 'archived'] as const)(
      'rejects a %s account on either side',
      async (status) => {
        for (const index of [0, 1, 2]) {
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

    it('rejects a non-transfer source or destination', async () => {
      for (const index of [0, 1]) {
        const payload = await fixture();
        const invalidAccount = makeTransferAccount({
          behavior: EExpenseAccountBehavior.RentAndUtilities,
          code: '502001',
          subType: EExpenseSubType.RentAndUtilities,
          type: ELedgerType.Expense,
        });
        payload.accounts[index] = {
          ...invalidAccount,
          id: payload.accounts[index].id,
        };
        await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
          index === 0
            ? journalEntryError.InvalidSourceType
            : journalEntryError.InvalidDestinationAccount
        );
      }
    });

    it('rejects identical source and destination accounts', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: payload.entry.lines.map((line) => ({
          ...line,
          accountId:
            line.accountId === payload.accounts[1].id
              ? payload.accounts[0].id
              : line.accountId,
        })),
      };
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DuplicateAccountsNotPermitted
      );
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

    it('accepts optional counterparties and still checks a variable-currency source balance', async () => {
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
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalled();
    });

    it.each([
      [false, null],
      [false, 9_999n],
      [false, 10_000n],
      [true, null],
      [true, 50n],
      [true, 100n],
    ] as const)(
      'checks current source balance, forex=%s, amount=%s',
      async (forex, amount) => {
        const payload = await fixture(forex);
        const source = payload.accounts[0];
        mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(
          amount === null
            ? null
            : makeSourceAccountBalance(
                source.id,
                source.accountingEntityId,
                forex ? SYSTEM_CURRENCIES.USD : SYSTEM_CURRENCIES.NGN,
                amount
              )
        );
        const posting = service.postDraft(payload, repoOptions);
        if (amount === (forex ? 100n : 10_000n)) {
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
