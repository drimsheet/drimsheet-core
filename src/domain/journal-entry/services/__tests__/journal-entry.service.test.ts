import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import {
  EPeriodStatus,
  EPeriodUnit,
  IAccountingPeriod,
} from '@domain/accounting/types/period.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import {
  EJournalEntryAuditAction,
  EJournalLineAuditAction,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  ICreatePaymentEntryPayload,
  ICreateReceiptEntryPayload,
  ICreateTransferEntryPayload,
} from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import payablesMetaValue from '@domain/ledger/values/payables-meta.vo.';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

const mockLedgerCodeAllocationService: jest.Mocked<ILedgerCodeAllocationService> =
  { getNextCode: jest.fn() };

const mockAccountingPeriodService: jest.Mocked<IAccountingPeriodService> = {
  validatePostingPeriod: jest.fn(),
};

const mockLedgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
  create: jest.fn(),
  adjustBalance: jest.fn(),
  findByAccountId: jest.fn(),
  findAdjustmentsByAccountId: jest.fn(),
  findAllByAccountIds: jest.fn(),
};

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
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

describe('journalEntryService', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'journal-entry-service-test',
  };
  const openPeriod: IAccountingPeriod = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    name: 'August 2026',
    accountingEntityId: generateUUID(),
    unit: EPeriodUnit.Month,
    count: 1,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T23:59:59.999Z'),
    status: EPeriodStatus.Open,
    fiscalYearId: generateUUID(),
    closedAt: null,
    updatedAt: timestamp,
  };
  const service = makeJournalEntryService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: {
      findOne: jest.fn(),
      findByLedgerAccountId: jest.fn(),
      create: jest.fn(),
    },
    ledgerCodeAllocationService: { getNextCode: jest.fn() },
  });
  const equityAccountService = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const servicesAccountService = makeServicesAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  const payablesAccountService = makePayablesAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });

  async function makeReceiptFixture(postedAt: Date | null = null) {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'receipt@example.com',
      emailVerified: true,
      firstName: 'Receipt',
      lastName: 'Maker',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Receipt LLC',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: user.id,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [counterparty] = counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: accountingEntity.id,
      name: 'Receipt Customer',
      type: ECounterpartyType.Organization,
    });
    const [taxAuthority] = counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: accountingEntity.id,
      name: 'Tax Authority',
      type: ECounterpartyType.Organization,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [servicesHeader] = await servicesAccountService.createHeader(
      {
        name: 'Services',
        createdBy: user.actorId,
        accountingEntity,
      },
      repoOptions
    );
    const [sourceAccountWithoutOpeningDate] = ((
      payload: Omit<
        Parameters<typeof servicesAccountService.createSubAccount>[0],
        'controlAccountId'
      > & { controlAccount: ILedgerAccount }
    ) => {
      const controlAccount = payload.controlAccount;
      const code = String(Number(controlAccount.code) + 1).padStart(6, '0');
      const materializedPath = controlAccount.materializedPath + '.' + code;
      return ledgerAccountEntity.make<ILedgerAccount>({
        name: payload.name,
        accountingEntityId: payload.accountingEntityId,
        code,
        materializedPath,
        normalBalance: 'credit',
        type: 'revenue',
        subType: 'services',
        behavior: 'services',
        isControlAccount: payload.isControlAccount,
        controlAccountId: controlAccount.id,
        currency: null,
        meta: null,
        status: 'active',
        contraAccountRule: 'contra_not_permitted',
        adjunctAccountRule: 'adjunct_not_permitted',
        createdBy: payload.createdBy,
      }) as Awaited<ReturnType<typeof servicesAccountService.createSubAccount>>;
    })({
      name: 'Service Revenue',
      accountingEntityId: accountingEntity.id,
      isControlAccount: false,
      controlAccount: servicesHeader,
      createdBy: user.actorId,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [payablesHeader] = await payablesAccountService.createHeader(
      {
        name: 'Payables',
        createdBy: user.actorId,
        accountingEntity,
      },
      repoOptions
    );
    const [vatPayableAccountWithoutOpeningDate] = ((
      payload: Omit<
        Parameters<
          typeof payablesAccountService.createStatutoryPayableSubAccount
        >[0],
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
        normalBalance: 'credit',
        type: 'liability',
        subType: 'payable',
        behavior: 'tax_payable',
        isControlAccount: payload.isControlAccount,
        controlAccountId: controlAccount.id,
        currency: payload.currency,
        status: 'active',
        meta: payablesMetaValue.makeStatutoryMeta(payload.meta),
        contraAccountRule: 'contra_not_permitted',
        adjunctAccountRule: 'adjunct_not_permitted',
        createdBy: payload.createdBy,
      }) as Awaited<
        ReturnType<
          typeof payablesAccountService.createStatutoryPayableSubAccount
        >
      >;
    })({
      name: 'VAT Payable',
      createdBy: user.actorId,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      controlAccount: payablesHeader,
      meta: {
        taxAuthority: 'Federal Inland Revenue Service',
        taxType: 'vat',
      },
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [cashHeader] = await cashAccountService.createHeader(
      {
        name: 'Cash and Cash Equivalents',
        accountingEntity,
        createdBy: user.actorId,
      },
      repoOptions
    );
    const [destinationAccountWithoutOpeningDate] = ((
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
      name: 'Cash on Hand',
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      controlAccount: cashHeader,
      accountingEntity,
      createdBy: user.actorId,
    });
    const [sourceAccount] = ledgerAccountEntity.updateOpeningBalanceDate(
      sourceAccountWithoutOpeningDate,
      effectiveDate
    );
    const [vatPayableAccount] = ledgerAccountEntity.updateOpeningBalanceDate(
      vatPayableAccountWithoutOpeningDate,
      effectiveDate
    );
    const [destinationAccount] = ledgerAccountEntity.updateOpeningBalanceDate(
      destinationAccountWithoutOpeningDate,
      effectiveDate
    );
    const salesAmount = moneyValue.make(9_250n, SYSTEM_CURRENCIES.NGN, true);
    const vatAmount = moneyValue.make(750n, SYSTEM_CURRENCIES.NGN, true);
    const receiptAmount = moneyValue.make(10_000n, SYSTEM_CURRENCIES.NGN, true);

    const payload: ICreateReceiptEntryPayload = {
      attachments: [
        {
          url: 'https://files.example.com/receipt.pdf',
          name: 'receipt.pdf',
          type: 'application/pdf',
          size: 2048,
        },
      ],
      header: {
        accountingEntityId: accountingEntity.id,
        memo: 'Customer receipt',
        effectiveDate,
        postedAt,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        createdBy: user.actorId,
      },
      sourceLines: [
        {
          account: sourceAccount,
          counterparty,
          sequenceOrder: 1,
          amount: salesAmount,
          exchangeRate: null,
          description: 'Service revenue',
          meta: null,
        },
        {
          account: vatPayableAccount,
          counterparty: taxAuthority,
          sequenceOrder: 2,
          amount: vatAmount,
          exchangeRate: null,
          description: 'VAT payable',
          meta: null,
        },
      ],
      destinationLine: {
        account: destinationAccount,
        counterparty,
        sequenceOrder: 3,
        amount: receiptAmount,
        exchangeRate: null,
        description: 'Cash received',
        meta: null,
      },
    };

    return {
      payload,
      counterparty,
      taxAuthority,
      sourceAccount,
      vatPayableAccount,
      destinationAccount,
      user,
      accountingEntity,
    };
  }

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
      normalBalance: getLedgerAccountNormalBalance(type),
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
    const sourceAccount = makePaymentAccount({
      accountingEntityId: accountingEntity.id,
      behavior: EAssetAccountBehavior.Bank,
      code: '100001',
      createdBy: user.actorId,
      name: 'Operating bank',
    });
    const destinationAccount = makePaymentAccount({
      accountingEntityId: accountingEntity.id,
      behavior: 'petty_cash',
      code: '100002',
      createdBy: user.actorId,
      name: 'Petty cash',
    });
    const bankChargeAccount = makePaymentAccount({
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
    mockLedgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
      []
    );
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
      openPeriod
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['payment', false],
    ['payment', true],
    ['receipt', false],
    ['receipt', true],
    ['transfer', false],
    ['transfer', true],
  ] as const)(
    'rejects archived accounts inside %s creation (posted: %s)',
    async (kind, posted) => {
      const postedAt = posted ? effectiveDate : null;

      if (kind === 'receipt') {
        const { payload } = await makeReceiptFixture(postedAt);
        payload.sourceLines[0].account = ledgerAccountEntity.archive(
          payload.sourceLines[0].account
        )[0];

        await expect(
          service.createReceipt(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      } else if (kind === 'payment') {
        const { payload } = makePaymentFixture(postedAt);
        payload.sourceLine.account = ledgerAccountEntity.archive(
          payload.sourceLine.account
        )[0];

        await expect(
          service.createPayment(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      } else {
        const { payload, bankChargeAccount } = makeTransferFixture(postedAt);
        payload.destinationLines.push({
          ...payload.destinationLines[0],
          account: ledgerAccountEntity.archive(bankChargeAccount)[0],
          amount: moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true),
          sequenceOrder: 3,
        });

        await expect(
          service.createTransfer(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }

      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    }
  );

  it.each(['payment', 'receipt', 'transfer'] as const)(
    'permits draft counterparties only before posting a %s',
    async (kind) => {
      const fixture =
        kind === 'receipt'
          ? await makeReceiptFixture()
          : kind === 'payment'
            ? makePaymentFixture()
            : makeTransferFixture();
      const [draft] = counterpartyEntity.make({
        accountingEntityId: fixture.payload.header.accountingEntityId,
        createdBy: fixture.payload.header.createdBy,
        name: 'Draft counterparty',
        type: 'organization',
        status: 'draft',
      });
      if (kind === 'receipt') {
        const payload = fixture.payload as ICreateReceiptEntryPayload;
        payload.sourceLines[0].counterparty = draft;
        await expect(
          service.createReceipt(payload, repoOptions)
        ).resolves.toBeDefined();
        payload.header.postedAt = effectiveDate;
        await expect(
          service.createReceipt(payload, repoOptions)
        ).rejects.toThrow(journalEntryError.DraftCounterpartyNotAllowed);
      } else if (kind === 'payment') {
        const payload = fixture.payload as ICreatePaymentEntryPayload;
        payload.destinationLines[0].counterparty = draft;
        await expect(
          service.createPayment(payload, repoOptions)
        ).resolves.toBeDefined();
        payload.header.postedAt = effectiveDate;
        await expect(
          service.createPayment(payload, repoOptions)
        ).rejects.toThrow(journalEntryError.DraftCounterpartyNotAllowed);
      } else {
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
        await expect(
          service.createTransfer(payload, repoOptions)
        ).resolves.toBeDefined();
        payload.header.postedAt = effectiveDate;
        await expect(
          service.createTransfer(payload, repoOptions)
        ).rejects.toThrow(journalEntryError.DraftCounterpartyNotAllowed);
      }
    }
  );

  it.each(['payment', 'receipt', 'transfer'] as const)(
    'permits draft accounts on either side only before posting a %s',
    async (kind) => {
      for (const side of ['source', 'destination'] as const) {
        if (kind === 'receipt') {
          const { payload } = await makeReceiptFixture();
          const line =
            side === 'source'
              ? payload.sourceLines[0]
              : payload.destinationLine;
          line.account = ledgerAccountEntity.make({
            ...line.account,
            status: ELedgerAccountStatus.Draft,
            controlAccountId: generateUUID(),
          })[0];
          const [entry] = await service.createReceipt(payload, repoOptions);
          expect(entry.status).toBe(EJournalEntryStatus.Draft);
          expect(entry.postedAt).toBeNull();
          payload.header.postedAt = effectiveDate;
          await expect(
            service.createReceipt(payload, repoOptions)
          ).rejects.toThrow(journalEntryError.DraftLedgerAccountNotAllowed);
        } else if (kind === 'payment') {
          const { payload } = makePaymentFixture();
          const line =
            side === 'source'
              ? payload.sourceLine
              : payload.destinationLines[0];
          line.account = ledgerAccountEntity.make({
            ...line.account,
            status: ELedgerAccountStatus.Draft,
            controlAccountId: generateUUID(),
          })[0];
          const [entry] = await service.createPayment(payload, repoOptions);
          expect(entry.status).toBe(EJournalEntryStatus.Draft);
          expect(entry.postedAt).toBeNull();
          payload.header.postedAt = effectiveDate;
          await expect(
            service.createPayment(payload, repoOptions)
          ).rejects.toThrow(journalEntryError.DraftLedgerAccountNotAllowed);
        } else {
          const { payload } = makeTransferFixture();
          const line =
            side === 'source'
              ? payload.sourceLine
              : payload.destinationLines[0];
          line.account = ledgerAccountEntity.make({
            ...line.account,
            status: ELedgerAccountStatus.Draft,
            controlAccountId: generateUUID(),
          })[0];
          const {
            journalEntry: [entry],
          } = await service.createTransfer(payload, repoOptions);
          expect(entry.status).toBe(EJournalEntryStatus.Draft);
          expect(entry.postedAt).toBeNull();
          payload.header.postedAt = effectiveDate;
          await expect(
            service.createTransfer(payload, repoOptions)
          ).rejects.toThrow(journalEntryError.DraftLedgerAccountNotAllowed);
        }
      }
    }
  );

  it('creates a draft receipt with mapped lines, events, and audits', async () => {
    const {
      payload,
      counterparty,
      taxAuthority,
      sourceAccount,
      vatPayableAccount,
      destinationAccount,
    } = await makeReceiptFixture();

    const [entry, events, audit] = await service.createReceipt(
      payload,
      repoOptions
    );

    expect(entry).toEqual(
      expect.objectContaining({
        accountingEntityId: payload.header.accountingEntityId,
        sourceType: EJournalEntrySourceType.Receipt,
        status: EJournalEntryStatus.Draft,
        postedAt: null,
      })
    );
    expect(entry.lines).toEqual([
      expect.objectContaining({
        accountId: sourceAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder: 1,
        side: EJournalSide.Credit,
        description: 'Service revenue',
      }),
      expect.objectContaining({
        accountId: vatPayableAccount.id,
        counterpartyId: taxAuthority.id,
        sequenceOrder: 2,
        side: EJournalSide.Credit,
        description: 'VAT payable',
      }),
      expect.objectContaining({
        accountId: destinationAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder: 3,
        side: EJournalSide.Debit,
        description: 'Cash received',
      }),
    ]);
    expect(entry.attachments).toEqual(payload.attachments);
    expect(Object.isFrozen(entry.attachments)).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      EJournalEntryEvent.Created,
      EJournalLineItemEvent.Created,
      EJournalLineItemEvent.Created,
      EJournalLineItemEvent.Created,
    ]);
    expect(audit.header.action).toBe(EJournalEntryAuditAction.Created);
    expect(audit.lines.map((lineAudit) => lineAudit.action)).toEqual([
      EJournalLineAuditAction.Created,
      EJournalLineAuditAction.Created,
      EJournalLineAuditAction.Created,
    ]);
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).toHaveBeenCalledWith(
      payload.header.accountingEntityId,
      payload.header.effectiveDate,
      repoOptions
    );
  });

  it('creates a posted receipt when a posting date is provided', async () => {
    const { payload } = await makeReceiptFixture(timestamp);

    const [entry] = await service.createReceipt(payload, repoOptions);

    expect(entry.status).toBe(EJournalEntryStatus.Posted);
    expect(entry.postedAt).toBe(timestamp);
  });

  it('rejects a non-permitted source account', async () => {
    const { payload } = await makeReceiptFixture();
    payload.sourceLines[0] = {
      ...payload.sourceLines[0],
      account: payload.destinationLine.account,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidSourceType
    );
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('validates every source account against the receipt rule', async () => {
    const { payload } = await makeReceiptFixture();
    payload.sourceLines[1] = {
      ...payload.sourceLines[1],
      account: payload.destinationLine.account,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidSourceType
    );
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('rejects a non-permitted destination account', async () => {
    const { payload } = await makeReceiptFixture();
    payload.destinationLine = {
      ...payload.destinationLine,
      account: payload.sourceLines[0].account,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidDestinationAccount
    );
  });

  it('rejects an account belonging to another accounting entity', async () => {
    const { payload, user } = await makeReceiptFixture();
    const [otherAccountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Other Entity',
      type: EAccountingEntityType.PrivateCompany,
      ownerId: user.id,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [otherCashHeader] = await cashAccountService.createHeader(
      {
        name: 'Other Entity Cash Header',
        accountingEntity: otherAccountingEntity,
        createdBy: user.actorId,
      },
      repoOptions
    );
    const [account] = ((
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
      name: 'Other Entity Cash',
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      controlAccount: otherCashHeader,
      accountingEntity: otherAccountingEntity,
      createdBy: user.actorId,
    });
    payload.destinationLine = {
      ...payload.destinationLine,
      account,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidAccountingEntity
    );
  });

  it('rejects a control account', async () => {
    const { payload, accountingEntity, user } = await makeReceiptFixture();
    const [controlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash Control',
        accountingEntity,
        createdBy: user.actorId,
      },
      repoOptions
    );
    payload.destinationLine = {
      ...payload.destinationLine,
      account: controlAccount,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.ControlAccountNotAllowed
    );
  });

  it('rejects a line whose amount currency does not match its fixed-currency account', async () => {
    const { payload } = await makeReceiptFixture();
    payload.destinationLine = {
      ...payload.destinationLine,
      amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.USD, true),
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.JournalLineAccountCurrencyMismatch
    );
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('rejects a destination amount that does not equal all source amounts', async () => {
    const { payload } = await makeReceiptFixture();
    payload.destinationLine = {
      ...payload.destinationLine,
      amount: moneyValue.make(9_999n, SYSTEM_CURRENCIES.NGN, true),
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.UnbalancedJournalEntry
    );
  });

  it('allows an entry after the account opening balance date', async () => {
    const { payload } = await makeReceiptFixture();
    const openingBalanceDate = new Date('2026-08-01T10:00:00.000Z');
    payload.sourceLines[0] = {
      ...payload.sourceLines[0],
      account: {
        ...payload.sourceLines[0].account,
        openingBalanceDate,
      },
    };
    payload.destinationLine = {
      ...payload.destinationLine,
      account: {
        ...payload.destinationLine.account,
        openingBalanceDate,
      },
    };

    const [entry] = await service.createReceipt(payload, repoOptions);

    expect(entry.effectiveDate).toBe(payload.header.effectiveDate);
  });

  it('allows an entry when account opening balance dates are not set', async () => {
    const { payload } = await makeReceiptFixture();
    payload.sourceLines[0] = {
      ...payload.sourceLines[0],
      account: {
        ...payload.sourceLines[0].account,
        openingBalanceDate: null,
      },
    };
    payload.destinationLine = {
      ...payload.destinationLine,
      account: {
        ...payload.destinationLine.account,
        openingBalanceDate: null,
      },
    };

    const [entry] = await service.createReceipt(payload, repoOptions);

    expect(entry.effectiveDate).toBe(payload.header.effectiveDate);
  });

  it('rejects an entry before the account opening balance date', async () => {
    const { payload } = await makeReceiptFixture();
    const openingBalanceDate = new Date('2026-08-04T09:00:00.000Z');
    payload.sourceLines[0] = {
      ...payload.sourceLines[0],
      account: {
        ...payload.sourceLines[0].account,
        openingBalanceDate,
      },
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.EffectiveDateIsBeforeOpeningDate
    );
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).not.toHaveBeenCalled();
  });

  it('rejects a counterparty belonging to another accounting entity after validating the posting period', async () => {
    const { payload } = await makeReceiptFixture();
    const [invalidCounterparty] = counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: generateUUID(),
      name: 'Other Customer',
      type: ECounterpartyType.Organization,
    });
    payload.sourceLines[0] = {
      ...payload.sourceLines[0],
      counterparty: invalidCounterparty,
    };

    await expect(service.createReceipt(payload, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidCounterpartyId
    );
    expect(
      mockAccountingPeriodService.validatePostingPeriod
    ).toHaveBeenCalledTimes(1);
  });

  describe('createPayment', () => {
    it('creates a draft payment with mapped lines, events, and audits', async () => {
      const { payload, sourceAccount, rentAccount, payableAccount } =
        makePaymentFixture();

      const [entry, events, audit] = await service.createPayment(
        payload,
        repoOptions
      );

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
      expect(audit.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit.lines).toHaveLength(3);
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

      const [entry] = await service.createPayment(payload, repoOptions);

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

      const [entry] = await service.createPayment(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    });

    it('creates a draft FOREX payment without reading the source account balance', async () => {
      const { payload } = makeForexPaymentFixture();

      const [entry] = await service.createPayment(payload, repoOptions);

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

      await expect(
        service.createPayment(payload, repoOptions)
      ).resolves.toEqual(expect.any(Array));
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

      await expect(service.createPayment(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InsufficientSourceAccountBalance
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a posted FOREX payment with a missing source account balance before period validation', async () => {
      const { payload } = makeForexPaymentFixture(timestamp);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(null);

      await expect(service.createPayment(payload, repoOptions)).rejects.toThrow(
        journalEntryError.MissingSourceAccountBalance
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a non-permitted source account before period validation', async () => {
      const { payload, rentAccount } = makePaymentFixture();
      payload.sourceLine = { ...payload.sourceLine, account: rentAccount };

      await expect(service.createPayment(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.createPayment(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('rejects an unbalanced payment', async () => {
      const { payload } = makePaymentFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(6_999n, SYSTEM_CURRENCIES.NGN, true),
      };

      await expect(service.createPayment(payload, repoOptions)).rejects.toThrow(
        journalEntryError.UnbalancedJournalEntry
      );
    });
  });

  describe('createTransfer', () => {
    it('creates a draft transfer with mapped lines, attachments, events, and audits', async () => {
      const { destinationAccount, payload, sourceAccount } =
        makeTransferFixture();

      const {
        journalEntry: [entry, events, audit],
        destinationAssetAccount,
      } = await service.createTransfer(payload, repoOptions);

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
      expect(audit.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit.lines).toHaveLength(2);
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
      } = await service.createTransfer(payload, repoOptions);

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

      await expect(
        service.createTransfer(payload, repoOptions)
      ).resolves.toEqual(
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

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InsufficientSourceAccountBalance);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a transfer with a missing source account balance before period validation', async () => {
      const { payload } = makeTransferFixture(timestamp);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(null);

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.MissingSourceAccountBalance);
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
      } = await service.createTransfer(payload, repoOptions);

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
      } = await service.createTransfer(payload, repoOptions);

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
      } = await service.createTransfer(payload, repoOptions);

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
      expect(audit.lines).toHaveLength(3);
    });

    it('rejects duplicate transfer accounts before period validation', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        account: payload.sourceLine.account,
      };

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.DuplicateAccountsNotPermitted);
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
        account: makePaymentAccount({
          accountingEntityId: payload.header.accountingEntityId,
          behavior: EExpenseAccountBehavior.RentAndUtilities,
          code: '502001',
          subType: EExpenseSubType.RentAndUtilities,
          type: ELedgerType.Expense,
        }),
      };

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidSourceType);
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

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.CounterpartyIdNotAllowed);
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
      } = await service.createTransfer(payload, repoOptions);

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

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidCounterpartyId);
    });

    it('rejects a destination collection without a cash asset', async () => {
      const { bankChargeAccount, payload } = makeTransferFixture();
      payload.destinationLines = [
        {
          ...payload.destinationLines[0],
          account: bankChargeAccount,
        },
      ];

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects a destination collection with multiple cash assets', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines.push({
        ...payload.destinationLines[0],
        account: makePaymentAccount({
          accountingEntityId: payload.header.accountingEntityId,
          code: '100003',
        }),
        sequenceOrder: 3,
      });

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects an additional destination that is not a Bank Charge', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines.push({
        ...payload.destinationLines[0],
        account: makePaymentAccount({
          accountingEntityId: payload.header.accountingEntityId,
          behavior: EExpenseAccountBehavior.RentAndUtilities,
          code: '502001',
          subType: EExpenseSubType.RentAndUtilities,
          type: ELedgerType.Expense,
        }),
        sequenceOrder: 3,
      });

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects an unbalanced transfer', async () => {
      const { payload } = makeTransferFixture();
      payload.destinationLines[0] = {
        ...payload.destinationLines[0],
        amount: moneyValue.make(9_999n, SYSTEM_CURRENCIES.NGN, true),
      };

      await expect(
        service.createTransfer(payload, repoOptions)
      ).rejects.toThrow(journalEntryError.UnbalancedJournalEntry);
    });
  });

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
        const payload: Parameters<typeof service.createOpeningBalance>[0] =
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
          service.createOpeningBalance(payload, repoOptions)
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
            service.createOpeningBalance(payload, transactionOptions)
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

    it('creates a posted opening balance with the configured equity account', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      const [entry, events, audit] = await service.createOpeningBalance(
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
        service.createOpeningBalance(
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
        service.createOpeningBalance(
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
        service.createOpeningBalance(
          makeOpeningBalancePayload(fixture),
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.ExistingOpeningBalance);
      expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    });

    it('rejects when the opening balance equity account is not configured', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([]);

      await expect(
        service.createOpeningBalance(
          makeOpeningBalancePayload(fixture),
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.UnConfiguredOpeningBalanceAccount);
    });

    it('rejects a configured account that violates the opening balance destination rule', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.postingAccount,
      ]);

      await expect(
        service.createOpeningBalance(
          makeOpeningBalancePayload(fixture),
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });

    it('rejects an opening-balance account belonging to another accounting entity', async () => {
      const fixture = await makeOpeningBalanceFixture();
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);

      await expect(
        service.createOpeningBalance(
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
        service.createOpeningBalance(
          {
            ...makeOpeningBalancePayload(fixture),
            amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.JournalLineAccountCurrencyMismatch);
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
        service.createOpeningBalance(
          { ...makeOpeningBalancePayload(fixture), exchangeRate },
          repoOptions
        )
      ).rejects.toThrow(journalLineError.UnsupportedExchangeRate);
    });
  });
});
