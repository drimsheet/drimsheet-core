import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
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
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import makeOpeningBalanceEntryService from '@domain/journal-entry/services/opening-balance-entry.service';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
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

const mockJournalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
  existsByAccountingEntityId: jest.fn(),
  existsPostedByAccountId: jest.fn(),
  existsOpeningBalanceByAccountId: jest.fn(),
  findDraftOpeningBalanceByAccountId: jest.fn(),
  existsByAccountId: jest.fn(),
  findAllByAccountIds: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
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
    journalEntryRepo: mockJournalEntryRepo,
    journalEntryService: makeJournalEntryService({
      accountingPeriodService: mockAccountingPeriodService,
      ledgerAccountRepo: mockLedgerAccountRepo,
    }),
    ledgerAccountRepo: mockLedgerAccountRepo,
    accountingPeriodService: mockAccountingPeriodService,
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
    mockJournalEntryRepo.existsOpeningBalanceByAccountId.mockResolvedValue(
      false
    );
    mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValue(false);
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

    it.each(['create', 'createDraft'] as const)(
      '%s rejects an existing opening journal',
      async (operation) => {
        const payload = makeOpeningBalancePayload(
          await makeOpeningBalanceFixture()
        );
        mockJournalEntryRepo.existsOpeningBalanceByAccountId.mockResolvedValueOnce(
          true
        );

        await expect(
          service[operation](payload, repoOptions)
        ).rejects.toBeInstanceOf(journalEntryError.ExistingOpeningBalance);
      }
    );

    describe('posted creation eligibility', () => {
      const transactionOptions = { ...repoOptions, tx: {} };

      it.each([
        new periodError.PostingDateNotCovered(),
        new periodError.PostingPeriodAmbiguous(),
        new periodError.PostingPeriodNotOpen(),
        new Error('Period lookup failed'),
      ])('rejects when period validation fails: %s', async (failure) => {
        const fixture = await makeOpeningBalanceFixture();
        const payload = makeOpeningBalancePayload(fixture);
        mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
          failure
        );

        await expect(service.create(payload, transactionOptions)).rejects.toBe(
          failure
        );
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenCalledWith(
          payload.accountingEntityId,
          payload.effectiveDate,
          { ...transactionOptions, lock: ERepoLock.Share }
        );
        expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
      });

      it('rejects posted activity effective before the opening date', async () => {
        const payload = makeOpeningBalancePayload(
          await makeOpeningBalanceFixture()
        );
        mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValueOnce(
          true
        );

        await expect(
          service.create(payload, transactionOptions)
        ).rejects.toBeInstanceOf(ledgerAccountError.OpeningBalanceLocked);
        expect(
          mockJournalEntryRepo.existsPostedByAccountId
        ).toHaveBeenCalledWith(
          payload.account.id,
          payload.accountingEntityId,
          transactionOptions,
          payload.effectiveDate
        );
      });
    });

    it('creates a draft and defers the opening date, posting history, and period checks', async () => {
      const fixture = await makeOpeningBalanceFixture();
      const payload = {
        ...makeOpeningBalancePayload(fixture),
        account: { ...fixture.postingAccount, openingBalanceDate: timestamp },
        effectiveDate,
      };
      const transactionOptions = { ...repoOptions, tx: {} };
      mockLedgerAccountRepo.findBySubType.mockResolvedValue([
        fixture.equityAccount,
      ]);
      mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValue(true);
      mockAccountingPeriodService.validatePostingPeriod.mockRejectedValue(
        new periodError.PostingPeriodNotOpen()
      );

      const [entry] = await service.createDraft(payload, transactionOptions);

      expect(entry).toMatchObject({
        status: EJournalEntryStatus.Draft,
        postedAt: null,
        effectiveDate: payload.effectiveDate,
      });
      expect(
        mockJournalEntryRepo.existsOpeningBalanceByAccountId
      ).toHaveBeenCalledWith(
        payload.account.id,
        payload.accountingEntityId,
        transactionOptions
      );
      expect(
        mockJournalEntryRepo.existsPostedByAccountId
      ).not.toHaveBeenCalled();
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).not.toHaveBeenCalled();
    });

    describe('updateDraft', () => {
      const transactionOptions = { ...repoOptions, tx: {} };

      it('retains the original date, amount, and FX rate when they are omitted', async () => {
        const fixture = await makeOpeningBalanceFixture(SYSTEM_CURRENCIES.USD);
        const payload = makeOpeningBalancePayload(fixture);
        const exchangeRate = exchangeRateValue.make({
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: 1500,
          type: EExchangeRateType.Negotiated,
          asOf: effectiveDate,
          source: 'Bank quote',
        });
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        const [entry] = await service.createDraft(
          { ...payload, exchangeRate },
          transactionOptions
        );

        const mutation = await service.updateDraft(
          { entry, createdBy: payload.createdBy, account: payload.account },
          transactionOptions
        );

        expect(mutation[0]).toBe(entry);
        expect(mutation.slice(1)).toEqual([[], null]);
      });

      it('rejects a line edit when the stored draft has no opening line', async () => {
        const fixture = await makeOpeningBalanceFixture();
        const payload = makeOpeningBalancePayload(fixture);
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        const [draft] = await service.createDraft(payload, transactionOptions);
        const functionalCurrency = SYSTEM_CURRENCIES.NGN;
        const [entry] = journalEntryEntity.make({
          ...draft,
          functionalCurrency,
          lines: draft.lines.map((line) => ({
            ...line,
            functionalCurrency,
            sequenceOrder: line.sequenceOrder + 1,
          })),
        });

        await expect(
          service.updateDraft(
            { entry, createdBy: payload.createdBy, amount: payload.amount },
            transactionOptions
          )
        ).rejects.toThrow(journalEntryError.MismatchedJournalLines);
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      });

      it('rejects a line edit when the opening account no longer exists', async () => {
        const fixture = await makeOpeningBalanceFixture();
        const payload = makeOpeningBalancePayload(fixture);
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        const [entry] = await service.createDraft(payload, transactionOptions);
        mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);

        await expect(
          service.updateDraft(
            { entry, createdBy: payload.createdBy, amount: payload.amount },
            transactionOptions
          )
        ).rejects.toThrow(journalEntryError.AccountNotFound);
        expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
          payload.account.id,
          entry.accountingEntityId,
          transactionOptions
        );
      });

      it('allows a proposed date before the account opened and checks it at posting', async () => {
        const fixture = await makeOpeningBalanceFixture();
        const account = {
          ...fixture.postingAccount,
          openingBalanceDate: timestamp,
        };
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        const [entry] = await service.createDraft(
          { ...makeOpeningBalancePayload(fixture), account },
          transactionOptions
        );

        const [updated, , audit] = await service.updateDraft(
          { entry, createdBy: fixture.user.actorId, effectiveDate },
          transactionOptions
        );

        expect(updated).toMatchObject({
          id: entry.id,
          status: EJournalEntryStatus.Draft,
          effectiveDate,
          lines: entry.lines,
        });
        expect(audit?.lines).toEqual([]);
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
        expect(
          mockJournalEntryRepo.existsPostedByAccountId
        ).not.toHaveBeenCalled();
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).not.toHaveBeenCalled();
        await expect(
          service.postDraft(
            { entry: updated, account, actor: fixture.user.actorId },
            transactionOptions
          )
        ).rejects.toBeInstanceOf(journalEntryError.InvalidOpeningBalanceDate);
      });

      it.each(['unchanged', 'date', 'date and amount'] as const)(
        'updates the existing draft in place for %s',
        async (change) => {
          const fixture = await makeOpeningBalanceFixture();
          mockLedgerAccountRepo.findBySubType.mockResolvedValue([
            fixture.equityAccount,
          ]);
          const originalPayload = {
            ...makeOpeningBalancePayload(fixture),
            effectiveDate: new Date('2026-08-02T00:00:00.000Z'),
          };
          const [account] = ledgerAccountEntity.make({
            ...fixture.postingAccount,
            status: ELedgerAccountStatus.Draft,
            openingBalanceDate: originalPayload.effectiveDate,
          });
          const [entry] = await service.createDraft(
            { ...originalPayload, account },
            transactionOptions
          );
          const revisedDate =
            change === 'unchanged'
              ? originalPayload.effectiveDate
              : effectiveDate;
          const amount =
            change === 'date and amount'
              ? moneyValue.make(250_000n, SYSTEM_CURRENCIES.NGN, true)
              : fixture.amount;
          mockLedgerAccountRepo.findById.mockResolvedValue(account);

          const [revised, events, audit] = await service.updateDraft(
            {
              ...originalPayload,
              entry,
              account: change === 'date and amount' ? undefined : account,
              effectiveDate: revisedDate,
              amount,
            },
            transactionOptions
          );

          expect(revised).toMatchObject({
            id: entry.id,
            status: EJournalEntryStatus.Draft,
            postedAt: null,
            effectiveDate: revisedDate,
          });
          expect(revised.lines.map((line) => line.id)).toEqual(
            entry.lines.map((line) => line.id)
          );
          expect(revised.lines[0].amount).toEqual(amount);
          if (change === 'date and amount') {
            expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
              account.id,
              entry.accountingEntityId,
              transactionOptions
            );
          }
          expect(
            mockAccountingPeriodService.validatePostingPeriod
          ).not.toHaveBeenCalled();
          if (change === 'unchanged') {
            expect(revised).toBe(entry);
            expect(events).toEqual([]);
            expect(audit).toBeNull();
          } else {
            expect(events.length).toBeGreaterThan(0);
            expect(audit?.header.diff.before).toBe(entry);
            expect(audit?.lines).toHaveLength(
              change === 'date and amount' ? 2 : 0
            );
          }
        }
      );
    });

    describe('voidAndReplace', () => {
      const transactionOptions = { ...repoOptions, tx: {} };
      const lockedReadOptions = {
        ...transactionOptions,
        lock: ERepoLock.Share,
      };

      async function makeCorrectionFixture() {
        const fixture = await makeOpeningBalanceFixture();
        const [account] = ledgerAccountEntity.updateOpeningBalanceDate(
          fixture.postingAccount,
          effectiveDate
        );
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);
        const [entry] = await service.create(
          { ...makeOpeningBalancePayload(fixture), account, effectiveDate },
          transactionOptions
        );
        mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
          account,
          fixture.equityAccount,
        ]);
        mockAccountingPeriodService.validatePostingPeriod.mockClear();

        return {
          entry,
          account,
          equity: fixture.equityAccount,
          createdBy: fixture.user.actorId,
          exchangeRate: null,
          amount: moneyValue.make(250_000n, SYSTEM_CURRENCIES.NGN, true),
        };
      }

      it('returns the audited void, reversal, and replacement on the opening date', async () => {
        const payload = await makeCorrectionFixture();
        const result = await service.voidAndReplace(
          payload,
          transactionOptions
        );
        const { entry } = payload;
        const { voided, reversal, replacement } = result;

        expect(reversal?.[0]).toMatchObject({
          status: EJournalEntryStatus.Posted,
          sourceType: EJournalEntrySourceType.Reversal,
          effectiveDate,
        });
        expect(voided[0]).toMatchObject({
          id: entry.id,
          version: entry.version + 1,
          status: EJournalEntryStatus.Voided,
          lines: entry.lines,
          voidingEntryId: reversal?.[0].id,
        });
        expect(voided[1]).toEqual([
          expect.objectContaining({
            type: EJournalEntryEvent.Voided,
            data: voided[0],
          }),
        ]);
        expect(voided[2]).toMatchObject({
          action: EJournalEntryAuditAction.Voided,
        });
        expect(replacement?.[0]).toMatchObject({
          status: EJournalEntryStatus.Posted,
          sourceType: EJournalEntrySourceType.OpeningBalance,
          effectiveDate,
          postedAt: timestamp,
          memo: entry.memo,
        });
        expect(replacement?.[0].id).not.toBe(entry.id);
        expect(replacement?.[0].lines.map((line) => line.amount)).toEqual([
          payload.amount,
          payload.amount,
        ]);
        expect(replacement?.[2].header.action).toBe(
          EJournalEntryAuditAction.Created
        );
        expect(entry.status).toBe(EJournalEntryStatus.Posted);
        expect(mockJournalEntryRepo.create).not.toHaveBeenCalled();
        expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
          [payload.account.id, payload.equity.id],
          entry.accountingEntityId,
          lockedReadOptions
        );
        expect(
          mockAccountingPeriodService.validatePostingPeriod.mock.calls
        ).toEqual([
          [entry.accountingEntityId, effectiveDate, lockedReadOptions],
        ]);
      });

      it('voids and replaces the original even when the amount is identical', async () => {
        const payload = await makeCorrectionFixture();
        const amount = payload.entry.lines[0].amount;

        const { voided, reversal, replacement } = await service.voidAndReplace(
          { ...payload, amount },
          repoOptions
        );

        expect(replacement?.[0].id).not.toBe(payload.entry.id);
        expect(replacement?.[0].lines[0].amount).toEqual(amount);
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenCalledWith(
          payload.entry.accountingEntityId,
          payload.entry.effectiveDate,
          repoOptions
        );
        expect(voided[0]).toMatchObject({
          id: payload.entry.id,
          status: EJournalEntryStatus.Voided,
          voidingEntryId: reversal?.[0].id,
        });
      });

      it('returns the original voided journal and skips replacement on retry', async () => {
        const payload = await makeCorrectionFixture();
        const {
          voided: [entry],
        } = await service.voidAndReplace(payload, transactionOptions);
        mockLedgerAccountRepo.findAllByIds.mockClear();
        mockLedgerAccountRepo.findBySubType.mockClear();
        mockJournalEntryRepo.existsPostedByAccountId.mockClear();
        mockAccountingPeriodService.validatePostingPeriod.mockClear();

        const { voided, reversal, replacement } = await service.voidAndReplace(
          { ...payload, entry },
          transactionOptions
        );

        expect(voided[0]).toBe(entry);
        expect(voided[1]).toEqual([]);
        expect(voided[2]).toBeNull();
        expect(reversal).toBeNull();
        expect(replacement).toBeNull();
        expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
        expect(
          mockJournalEntryRepo.existsPostedByAccountId
        ).not.toHaveBeenCalled();
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).not.toHaveBeenCalled();
      });

      it('rejects a draft opening journal', async () => {
        const payload = await makeCorrectionFixture();
        const [entry] = await service.createDraft(
          {
            ...payload,
            accountingEntityId: payload.entry.accountingEntityId,
            effectiveDate,
            functionalCurrencyCode: 'NGN',
          },
          transactionOptions
        );

        await expect(
          service.voidAndReplace({ ...payload, entry }, transactionOptions)
        ).rejects.toBeInstanceOf(journalEntryError.InvalidStatusTransition);
      });

      it('rejects a correction for the equity counterpart', async () => {
        const payload = await makeCorrectionFixture();

        await expect(
          service.voidAndReplace(
            { ...payload, account: payload.equity },
            transactionOptions
          )
        ).rejects.toBeInstanceOf(journalEntryError.RectificationNotPermitted);
      });

      it('rejects posted history effective before the opening date', async () => {
        const payload = await makeCorrectionFixture();
        mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValueOnce(
          true
        );

        await expect(
          service.voidAndReplace(payload, transactionOptions)
        ).rejects.toBeInstanceOf(ledgerAccountError.OpeningBalanceLocked);

        expect(
          mockJournalEntryRepo.existsPostedByAccountId
        ).toHaveBeenLastCalledWith(
          payload.account.id,
          payload.entry.accountingEntityId,
          transactionOptions,
          effectiveDate
        );
      });

      it('rejects an archived account on the original opening journal', async () => {
        const payload = await makeCorrectionFixture();
        mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([
          payload.account,
          { ...payload.equity, status: ELedgerAccountStatus.Archived },
        ]);

        await expect(
          service.voidAndReplace(payload, transactionOptions)
        ).rejects.toThrow(journalEntryError.ArchivedLedgerAccountNotAllowed);
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).not.toHaveBeenCalled();
      });

      it('rejects a closed opening period', async () => {
        const payload = await makeCorrectionFixture();
        const failure = new periodError.PostingPeriodNotOpen();
        mockAccountingPeriodService.validatePostingPeriod.mockRejectedValueOnce(
          failure
        );

        await expect(
          service.voidAndReplace(payload, transactionOptions)
        ).rejects.toBe(failure);
        expect(payload.entry.status).toBe(EJournalEntryStatus.Posted);
      });
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
      expect(mockLedgerAccountRepo.findBySubType).toHaveBeenCalledWith(
        fixture.accountingEntity.id,
        ELedgerType.Equity,
        EEquitySubType.OpeningBalance,
        repoOptions
      );
    });

    it.each([
      {
        status: 'active',
        currency: SYSTEM_CURRENCIES.USD,
        minorAmount: 10_000n,
        rate: 1_350,
        functionalMinorAmount: 13_500_000n,
      },
      {
        status: 'draft',
        currency: SYSTEM_CURRENCIES.USD,
        minorAmount: 10_000n,
        rate: 1_350,
        functionalMinorAmount: 13_500_000n,
      },
      {
        status: 'active',
        currency: SYSTEM_CURRENCIES.JPY,
        minorAmount: 150n,
        rate: 0.006,
        functionalMinorAmount: 90n,
      },
    ] as const)(
      'creates a balanced $currency.code opening with preserved exchange rate for a $status account',
      async ({
        status,
        currency,
        minorAmount,
        rate,
        functionalMinorAmount,
      }) => {
        const fixture = await makeOpeningBalanceFixture(currency);
        const [account] = ledgerAccountEntity.make({
          ...fixture.postingAccount,
          status,
          openingBalanceDate: new Date(timestamp.getTime() - 1),
        });
        const amount = moneyValue.make(minorAmount, currency, true);
        const functionalAmount = moneyValue.make(
          functionalMinorAmount,
          SYSTEM_CURRENCIES.NGN,
          true
        );
        const exchangeRate = exchangeRateValue.make({
          baseCurrencyCode: currency.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
          rate,
          type: EExchangeRateType.Market,
          asOf: new Date('2026-08-03T10:00:00.000Z'),
          source: 'Test Source',
        });
        mockLedgerAccountRepo.findBySubType.mockResolvedValue([
          fixture.equityAccount,
        ]);

        const create =
          status === 'draft' ? service.createDraft : service.create;
        const [entry] = await create(
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
        mockJournalEntryRepo.existsOpeningBalanceByAccountId
      ).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findBySubType).not.toHaveBeenCalled();
    });

    it('rejects an invalid effective date before reading posting history', async () => {
      const payload = makeOpeningBalancePayload(
        await makeOpeningBalanceFixture()
      );

      await expect(
        service.create(
          { ...payload, effectiveDate: new Date(NaN) },
          repoOptions
        )
      ).rejects.toBeInstanceOf(journalEntryError.InvalidEffectiveDate);
      expect(
        mockJournalEntryRepo.existsPostedByAccountId
      ).not.toHaveBeenCalled();
    });

    it('rejects an opening date mismatch before repository checks', async () => {
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
      ).rejects.toThrow(journalEntryError.InvalidOpeningBalanceDate);
      expect(
        mockJournalEntryRepo.existsOpeningBalanceByAccountId
      ).not.toHaveBeenCalled();
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

    const transactionOptions = { ...repoOptions, tx: {} };

    it.each([
      {
        currency: SYSTEM_CURRENCIES.NGN,
        options: repoOptions,
        periodReadOptions: repoOptions,
      },
      {
        currency: SYSTEM_CURRENCIES.USD,
        options: transactionOptions,
        periodReadOptions: { ...transactionOptions, lock: ERepoLock.Share },
      },
    ])(
      'posts an existing $currency.code opening journal at the current time while preserving its effective date, lines and valuation',
      async ({ currency, options, periodReadOptions }) => {
        const payload = fixture(currency);
        const [posted, events, audit] = await service.postDraft(
          payload,
          options
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
          options
        );
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenCalledWith(
          payload.entry.accountingEntityId,
          effectiveDate,
          periodReadOptions
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

    it('rejects posting when existing activity predates the proposed opening date', async () => {
      const payload = fixture();
      mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValueOnce(true);

      await expect(
        service.postDraft(payload, repoOptions)
      ).rejects.toBeInstanceOf(ledgerAccountError.OpeningBalanceLocked);
      expect(mockJournalEntryRepo.existsPostedByAccountId).toHaveBeenCalledWith(
        payload.account.id,
        payload.entry.accountingEntityId,
        repoOptions,
        payload.entry.effectiveDate
      );
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
