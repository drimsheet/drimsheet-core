import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import makeReceiptEntryService from '@domain/journal-entry/services/receipt-entry.service';
import {
  EJournalEntryAuditAction,
  EJournalLineAuditAction,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ICreateReceiptEntryPayload } from '@domain/journal-entry/types/receipt-entry.service.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import payablesMetaValue from '@domain/ledger/values/payables-meta.vo.';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

const mockLedgerAccountService: jest.Mocked<ILedgerAccountService> = {
  canDelete: jest.fn(),
  canUpdateCurrency: jest.fn(),
  validateCurrencyChange: jest.fn(),
  delete: jest.fn(),
  archive: jest.fn(),
  getNextCode: jest.fn(),
  promotePostingToControlAccount: jest.fn(),
};

const mockCounterpartyRepo: jest.Mocked<ICounterpartyRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteByAccountingEntityId: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
};

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

describe('receiptEntryService', () => {
  const timestamp = new Date('2026-08-04T10:00:00.000Z');
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'receipt-entry-service-test',
  };
  const service = makeReceiptEntryService({
    accountingPeriodService: mockAccountingPeriodService,
    counterpartyRepo: mockCounterpartyRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: {
      findOne: jest.fn(),
      findByLedgerAccountId: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    ledgerAccountService: {
      canDelete: jest.fn(),
      canUpdateCurrency: jest.fn(),
      validateCurrencyChange: jest.fn(),
      archive: jest.fn(),
      delete: jest.fn(),
      getNextCode: jest.fn(),
      promotePostingToControlAccount: jest.fn(),
    },
  });
  const servicesAccountService = makeServicesAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
  });
  const payablesAccountService = makePayablesAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
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

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
    jest.clearAllMocks();
    mockAccountingPeriodService.validatePostingPeriod.mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it.each([false, true])(
      'rejects archived accounts inside receipt creation (posted: %s)',
      async (posted) => {
        const postedAt = posted ? effectiveDate : null;
        const { payload } = await makeReceiptFixture(postedAt);
        payload.sourceLines[0].account = ledgerAccountEntity.archive(
          payload.sourceLines[0].account
        )[0];

        await expect(
          service.create(payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.Base);
      }
    );

    it('permits draft counterparties only before posting a receipt', async () => {
      const { payload } = await makeReceiptFixture();
      const [draft] = counterpartyEntity.make({
        accountingEntityId: payload.header.accountingEntityId,
        createdBy: payload.header.createdBy,
        name: 'Draft counterparty',
        type: 'organization',
        status: 'draft',
      });
      payload.sourceLines[0].counterparty = draft;
      await expect(service.create(payload, repoOptions)).resolves.toBeDefined();
      payload.header.postedAt = effectiveDate;
      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DraftCounterpartyNotAllowed
      );
    });

    it.each(['source', 'destination'] as const)(
      'permits draft accounts on the %s side only before posting a receipt',
      async (side) => {
        const { payload } = await makeReceiptFixture();
        const line =
          side === 'source' ? payload.sourceLines[0] : payload.destinationLine;
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

    it('creates a draft receipt with mapped lines, events, and audits', async () => {
      const {
        payload,
        counterparty,
        taxAuthority,
        sourceAccount,
        vatPayableAccount,
        destinationAccount,
      } = await makeReceiptFixture();

      const [entry, events, audit] = await service.create(payload, repoOptions);

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
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit?.lines.map((lineAudit) => lineAudit.action)).toEqual([
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

    it.each([
      new periodError.PostingDateNotCovered(),
      new periodError.PostingPeriodAmbiguous(),
      new periodError.PostingPeriodNotOpen(),
    ])(
      'rejects receipt creation when posting eligibility fails: %s',
      async (error) => {
        const { payload } = await makeReceiptFixture(timestamp);
        mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
          error
        );
        await expect(service.create(payload, repoOptions)).rejects.toBe(error);
      }
    );

    it('creates a posted receipt when a posting date is provided', async () => {
      const { payload } = await makeReceiptFixture(timestamp);

      const [entry] = await service.create(payload, repoOptions);

      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(entry.postedAt).toBe(timestamp);
    });

    it('rejects a non-permitted source account', async () => {
      const { payload } = await makeReceiptFixture();
      payload.sourceLines[0] = {
        ...payload.sourceLines[0],
        account: payload.destinationLine.account,
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.ControlAccountNotAllowed
      );
    });

    it('rejects a line whose amount currency does not match its fixed-currency account', async () => {
      const { payload } = await makeReceiptFixture();
      payload.destinationLine = {
        ...payload.destinationLine,
        amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.USD, true),
      };

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      const [entry] = await service.create(payload, repoOptions);

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

      const [entry] = await service.create(payload, repoOptions);

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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
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

      await expect(service.create(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidCounterpartyId
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateDraft', () => {
    async function makeDraftUpdate(postedAt: Date | null = null) {
      const receipt = await makeReceiptFixture(postedAt);
      const [entry] = await service.create(receipt.payload, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();

      const accounts = [
        receipt.sourceAccount,
        receipt.vatPayableAccount,
        receipt.destinationAccount,
      ];
      mockLedgerAccountRepo.findAllByIds.mockImplementation(async (ids) =>
        accounts.filter((account) => ids.includes(account.id))
      );
      const counterparties = [receipt.counterparty, receipt.taxAuthority];
      mockCounterpartyRepo.findByIds.mockImplementation(async (ids) =>
        counterparties.filter((counterparty) => ids.includes(counterparty.id))
      );

      return { accounts, draft: { entry, actor: receipt.user.actorId } };
    }

    it('changes the effective date and clears attachments without posting the draft', async () => {
      const {
        draft: { entry, actor },
      } = await makeDraftUpdate();
      const newDate = new Date('2026-08-05T00:00:00.000Z');
      const [updated, , audit] = await service.updateDraft(
        {
          entry,
          actor,
          effectiveDate: newDate,
          attachments: [],
        },
        repoOptions
      );

      expect(updated).toMatchObject({
        effectiveDate: newDate,
        status: EJournalEntryStatus.Draft,
        postedAt: null,
        attachments: [],
        lines: entry.lines,
      });
      expect(audit?.header.diff.before?.attachments).toEqual(entry.attachments);
      expect(audit?.header.diff.after.attachments).toEqual([]);
      expect(audit?.lines).toEqual([]);
      expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
        expect.arrayContaining(entry.lines.map((line) => line.accountId)),
        entry.accountingEntityId,
        repoOptions
      );
      expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
        expect.arrayContaining([entry.lines[0].counterpartyId]),
        entry.accountingEntityId,
        repoOptions
      );
    });

    it('rejects a date-only edit before an existing account opened', async () => {
      const {
        draft: { entry, actor },
        accounts,
      } = await makeDraftUpdate();
      const [source, ...destinations] = accounts;
      mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([
        { ...source, openingBalanceDate: entry.effectiveDate },
        ...destinations,
      ]);

      await expect(
        service.updateDraft(
          {
            entry,
            actor,
            effectiveDate: new Date('2026-08-01T00:00:00.000Z'),
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.EffectiveDateIsBeforeOpeningDate);
    });

    it('merges partial edits and audits a replacement source set', async () => {
      const { draft } = await makeDraftUpdate();
      const [sales, tax, cash] = draft.entry.lines;
      const [updated, events, audit] = await service.updateDraft(
        {
          ...draft,
          sourceLines: [
            {
              id: sales.id,
              amount: moneyValue.make(11_250n, SYSTEM_CURRENCIES.NGN, true),
            },
            {
              accountId: tax.accountId,
              sequenceOrder: tax.sequenceOrder,
              amount: tax.amount,
            },
          ],
          destinationLine: {
            amount: moneyValue.make(12_000n, SYSTEM_CURRENCIES.NGN, true),
            description: null,
          },
        },
        repoOptions
      );

      expect(updated.id).toBe(draft.entry.id);
      expect(updated.status).toBe(EJournalEntryStatus.Draft);
      expect(updated.postedAt).toBeNull();
      expect(updated.effectiveDate).toBe(draft.entry.effectiveDate);
      expect(updated.attachments).toEqual(draft.entry.attachments);
      expect(updated.lines).toEqual([
        expect.objectContaining({ id: sales.id, accountId: sales.accountId }),
        expect.objectContaining({ id: cash.id, description: null }),
        expect.objectContaining({
          id: expect.any(String),
          accountId: tax.accountId,
          side: EJournalSide.Credit,
        }),
      ]);
      expect(updated.lines.some((line) => line.id === tax.id)).toBe(false);
      expect(audit?.lines).toHaveLength(3);
      expect(events).toHaveLength(4);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('updates memo and attachments without loading payment participants', async () => {
      const {
        draft: { entry, actor },
      } = await makeDraftUpdate();
      const [updated, , audit] = await service.updateDraft(
        {
          entry,
          actor,
          memo: null,
          attachments: [],
        },
        repoOptions
      );

      expect(updated.memo).toBeNull();
      expect(updated.attachments).toEqual([]);
      expect(updated.lines).toEqual(entry.lines);
      expect(audit?.lines).toEqual([]);
      expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    });

    it('returns the original draft when retained lines are supplied in a different order', async () => {
      const { draft } = await makeDraftUpdate();
      const [sales, tax, cash] = draft.entry.lines;
      const [updated, events, audit] = await service.updateDraft(
        {
          ...draft,
          sourceLines: [{ id: tax.id }, { id: sales.id }],
          destinationLine: { id: cash.id },
        },
        repoOptions
      );

      expect(updated).toBe(draft.entry);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it('rejects a posted receipt', async () => {
      const { draft } = await makeDraftUpdate(timestamp);
      await expect(service.updateDraft(draft, repoOptions)).rejects.toThrow(
        journalEntryError.RectificationNotPermitted
      );
    });

    it('rejects the source line ID as a destination line ID', async () => {
      const { draft } = await makeDraftUpdate();
      await expect(
        service.updateDraft(
          {
            ...draft,
            destinationLine: { id: draft.entry.lines[0].id },
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.RectificationLineId);
    });

    it('rejects a revenue account as the destination', async () => {
      const { draft } = await makeDraftUpdate();
      await expect(
        service.updateDraft(
          {
            ...draft,
            destinationLine: { accountId: draft.entry.lines[0].accountId },
          },
          repoOptions
        )
      ).rejects.toThrow(journalEntryError.InvalidDestinationAccount);
    });
  });

  describe('voidAndReplace', () => {
    const correctionDate = new Date('2026-08-06T10:00:00.000Z');
    const replacementEffectiveDate = new Date('2026-08-05T10:00:00.000Z');

    async function makeReplacementFixture(postedAt: Date | null = timestamp) {
      const { payload, sourceAccount, destinationAccount, vatPayableAccount } =
        await makeReceiptFixture(postedAt);
      const [entry] = await service.create(payload, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();

      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
        sourceAccount,
        destinationAccount,
        vatPayableAccount,
      ]);
      jest.setSystemTime(correctionDate);

      const replacement: ICreateReceiptEntryPayload = {
        header: {
          ...payload.header,
          effectiveDate: replacementEffectiveDate,
          postedAt: correctionDate,
          createdBy: generateUUID(),
        },
        attachments: payload.attachments,
        sourceLines: [
          {
            ...payload.sourceLines[0],
            amount: moneyValue.make(8_250n, SYSTEM_CURRENCIES.NGN, true),
          },
          payload.sourceLines[1],
        ],
        destinationLine: {
          ...payload.destinationLine,
          amount: moneyValue.make(9_000n, SYSTEM_CURRENCIES.NGN, true),
        },
      };
      return { entry, replacement, sourceAccount };
    }

    it('returns the linked reversal, audited void, and corrected receipt', async () => {
      const { entry, replacement: payload } = await makeReplacementFixture();

      const { voided, reversal, replacement } = await service.voidAndReplace(
        entry,
        payload,
        repoOptions
      );

      const [reversingEntry, , reversalAudit] = reversal!;
      expect(reversingEntry).toMatchObject({
        sourceType: EJournalEntrySourceType.Reversal,
        status: EJournalEntryStatus.Posted,
        accountingEntityId: entry.accountingEntityId,
        effectiveDate: correctionDate,
        postedAt: correctionDate,
      });
      expect(reversingEntry.lines).toMatchObject(
        entry.lines.map((line) => ({
          accountId: line.accountId,
          counterpartyId: line.counterpartyId,
          amount: line.amount,
          functionalAmount: line.functionalAmount,
          side:
            line.side === EJournalSide.Credit
              ? EJournalSide.Debit
              : EJournalSide.Credit,
        }))
      );
      expect(reversalAudit.header.action).toBe(
        EJournalEntryAuditAction.Created
      );

      const [voidedEntry, voidEvents, voidAudit] = voided;
      expect(voidedEntry).toMatchObject({
        id: entry.id,
        status: EJournalEntryStatus.Voided,
        lines: entry.lines,
        voidingEntryId: reversingEntry.id,
      });
      expect(voidEvents.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Voided,
      ]);
      expect(voidAudit?.action).toBe(EJournalEntryAuditAction.Voided);
      expect(entry.status).toBe(EJournalEntryStatus.Posted);

      const [replacementEntry, replacementEvents, replacementAudit] =
        replacement!;
      expect(replacementEntry.id).not.toBe(entry.id);
      expect(replacementEntry).toMatchObject({
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Receipt,
        status: EJournalEntryStatus.Posted,
        effectiveDate: replacementEffectiveDate,
        postedAt: correctionDate,
        memo: entry.memo,
        attachments: entry.attachments,
        createdBy: payload.header.createdBy,
        lines: [
          ...payload.sourceLines.map((line) => ({
            accountId: line.account.id,
            amount: line.amount,
            side: EJournalSide.Credit,
          })),
          {
            accountId: payload.destinationLine.account.id,
            amount: payload.destinationLine.amount,
            side: EJournalSide.Debit,
          },
        ],
      });
      expect(replacementEvents[0].type).toBe(EJournalEntryEvent.Created);
      expect(replacementAudit.header.action).toBe(
        EJournalEntryAuditAction.Created
      );
      expect(
        mockAccountingPeriodService.validatePostingPeriod.mock.calls
      ).toEqual([
        [entry.accountingEntityId, correctionDate, repoOptions],
        [entry.accountingEntityId, replacementEffectiveDate, repoOptions],
      ]);
    });

    it('rejects a second correction of a voided receipt', async () => {
      const { entry, replacement } = await makeReplacementFixture();
      const {
        voided: [voidedEntry],
      } = await service.voidAndReplace(entry, replacement, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();

      await expect(
        service.voidAndReplace(voidedEntry, replacement, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidStatusTransition);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it('rejects a draft receipt', async () => {
      const { entry, replacement } = await makeReplacementFixture(null);

      await expect(
        service.voidAndReplace(entry, replacement, repoOptions)
      ).rejects.toThrow(journalEntryError.InvalidStatusTransition);
    });

    it('rejects a non-receipt entry', async () => {
      const { entry: receipt, replacement } = await makeReplacementFixture();
      const functionalCurrency = SYSTEM_CURRENCIES.NGN;
      const [entry] = journalEntryEntity.make({
        accountingEntityId: receipt.accountingEntityId,
        effectiveDate: receipt.effectiveDate,
        postedAt: receipt.postedAt,
        memo: receipt.memo,
        createdBy: receipt.createdBy,
        sourceType: EJournalEntrySourceType.Adjustment,
        functionalCurrency,
        lines: receipt.lines.map((line) => ({ ...line, functionalCurrency })),
      });

      await expect(
        service.voidAndReplace(entry, replacement, repoOptions)
      ).rejects.toThrow(journalEntryError.RectificationNotPermitted);
    });

    it('rejects reversal when an original account is archived', async () => {
      const { entry, replacement, sourceAccount } =
        await makeReplacementFixture();
      mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([
        { ...sourceAccount, status: ELedgerAccountStatus.Archived },
      ]);

      await expect(
        service.voidAndReplace(entry, replacement, repoOptions)
      ).rejects.toThrow(journalEntryError.ArchivedLedgerAccountNotAllowed);
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    it.each([0, 1])(
      'rejects when posting period check %i fails',
      async (failedCheck) => {
        const { entry, replacement } = await makeReplacementFixture();
        const failure = new periodError.PostingPeriodNotOpen();
        if (failedCheck === 1) {
          mockAccountingPeriodService.validatePostingPeriod.mockResolvedValueOnce(
            undefined
          );
        }
        mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
          failure
        );

        await expect(
          service.voidAndReplace(entry, replacement, repoOptions)
        ).rejects.toBe(failure);
        expect(entry.status).toBe(EJournalEntryStatus.Posted);
      }
    );
  });

  describe('postDraft', () => {
    async function fixture() {
      const receipt = await makeReceiptFixture();
      const [entry] = await service.create(receipt.payload, repoOptions);
      mockAccountingPeriodService.validatePostingPeriod.mockClear();
      const accounts: ILedgerAccount[] = [
        receipt.sourceAccount,
        receipt.destinationAccount,
        receipt.vatPayableAccount,
      ];
      return {
        entry,
        accounts,
        counterparties: [receipt.counterparty, receipt.taxAuthority],
        actor: receipt.payload.header.createdBy,
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
        destinationAccount,
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
      expect(destinationAccount.id).toBe(
        payload.entry.lines.find((line) => line.side === 'debit')!.accountId
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

    it.each(['payment', 'opening_balance', 'transfer'] as const)(
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
        payload.counterparties[1],
      ];
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.DraftCounterpartyNotAllowed
      );
    });

    it('rejects counterparties owned by another accounting entity', async () => {
      const payload = await fixture();
      payload.counterparties = [
        { ...payload.counterparties[0], accountingEntityId: generateUUID() },
        payload.counterparties[1],
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

    it('requires exactly one debit destination line', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: payload.entry.lines.map((line) => ({ ...line, side: 'debit' })),
      };
      await expect(service.postDraft(payload, repoOptions)).rejects.toThrow(
        journalEntryError.InvalidDestinationAccount
      );
    });

    it('accepts optional counterparties and a variable-currency destination without an FX balance read', async () => {
      const payload = await fixture();
      payload.entry = {
        ...payload.entry,
        lines: payload.entry.lines.map((line) => ({
          ...line,
          counterpartyId: null,
        })),
      };
      payload.accounts[1] = { ...payload.accounts[1], currency: null };
      await expect(
        service.postDraft({ ...payload, counterparties: [] }, repoOptions)
      ).resolves.toBeDefined();
    });

    it('preserves foreign receipt amounts and rates without requiring a source balance', async () => {
      const receipt = await makeReceiptFixture();
      const destinationAccount = {
        ...receipt.destinationAccount,
        currency: SYSTEM_CURRENCIES.USD,
      };
      receipt.payload.destinationLine = {
        ...receipt.payload.destinationLine,
        account: destinationAccount,
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
        exchangeRate: exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
          rate: 100,
          asOf: effectiveDate,
          type: EExchangeRateType.Negotiated,
          source: 'Test Source',
        }),
      };
      const [draft] = await service.create(receipt.payload, repoOptions);
      const {
        journalEntry: [posted],
      } = await service.postDraft(
        {
          entry: draft,
          accounts: [
            receipt.sourceAccount,
            receipt.vatPayableAccount,
            destinationAccount,
          ],
          counterparties: [receipt.counterparty, receipt.taxAuthority],
          actor: receipt.payload.header.createdBy,
        },
        repoOptions
      );
      expect(posted.lines).toEqual(draft.lines);
    });

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
