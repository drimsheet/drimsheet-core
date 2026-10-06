import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';
import { EPaginationSortDirection } from '@shared/values/pagination/types/pagination.types';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import {
  EJournalEntrySourceType,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ELedgerAccountBalanceEffect } from '@domain/ledger/types/ledger-account-balance.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockAccountTransactionQueryRepo from '@app/ledger/contracts/__mocks__/account-transaction.query.repo.mock';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeGetAccountTransactionsUseCase from '@app/ledger/usecases/get-account-transactions.usecase';

describe('getAccountTransactionsUseCase', () => {
  const correlationId = 'test-correlation-id';
  const pagination: IPaginationDto = {
    limit: 25,
    page: 2,
    orderBy: 'createdAt',
    sortDirection: EPaginationSortDirection.Desc,
    search: 'cash',
  };

  let user: IUser;
  let accountingEntity: IAccountingEntity;
  let ledgerAccount: ILedgerAccount;
  let journalEntry: IJournalEntry;
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });

  const getUseCase = () =>
    makeGetAccountTransactionsUseCase({
      accountingEntityService: mockAccountingEntityService,
      appContext: mockAppContext,
      ledgerAccountRepo: mockLedgerAccountRepo,
      accountTransactionQueryRepo: mockAccountTransactionQueryRepo,
    });

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    jest.clearAllMocks();

    [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'owner@example.com',
      emailVerified: true,
      firstName: 'Account',
      lastName: 'Owner',
    });
    [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Owner Business',
      ownerId: user.id,
      type: EAccountingEntityType.Individual,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });

    [ledgerAccount] = await cashAccountService.createHeader(
      {
        name: 'Main Cash',
        accountingEntity,
        createdBy: user.actorId,
      },
      { correlationId }
    );

    const amount = moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true);
    [journalEntry] = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: new Date('2026-05-01T00:00:00.000Z'),
      postedAt: new Date('2026-05-01T00:00:00.000Z'),
      memo: 'Cash transfer',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      createdBy: user.actorId,
      lines: [
        {
          accountId: ledgerAccount.id,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Debit cash',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: ledgerAccount.id,
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Credit cash',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });

    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey: 'test-idempotency-key',
      user,
      accountingEntity,
      clientSession: mockClientSession,
    } satisfies IAppContextData);
    mockLedgerAccountRepo.findById.mockResolvedValue(ledgerAccount);

    mockAccountTransactionQueryRepo.findAllByAccountId.mockResolvedValue({
      data: [
        {
          ...journalEntry.lines[0],
          header: {
            sourceType: journalEntry.sourceType,
            memo: journalEntry.memo,
            status: journalEntry.status,
            effectiveDate: journalEntry.effectiveDate,
            postedAt: journalEntry.postedAt,
            voidedAt: journalEntry.voidedAt,
            voidingEntryId: journalEntry.voidingEntryId,
            version: journalEntry.version,
            createdBy: journalEntry.createdBy,
            createdAt: journalEntry.createdAt,
            updatedAt: journalEntry.updatedAt,
          },
        },
      ],
      meta: {
        page: 2,
        limit: 25,
        total: 1,
        totalPages: 1,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns account transactions with journal headers', async () => {
    const useCase = getUseCase();

    const result = await useCase(ledgerAccount.id, pagination);

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      ledgerAccount.id,
      accountingEntity.id,
      { correlationId }
    );
    expect(
      mockAccountTransactionQueryRepo.findAllByAccountId
    ).toHaveBeenCalledWith(ledgerAccount.id, {
      correlationId,
      limit: pagination.limit,
      offset: 25,
      orderBy: pagination.orderBy,
      search: pagination.search,
      sortDirection: pagination.sortDirection,
    });
    expect(result).toEqual({
      data: [
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: journalEntry.lines[0].id,
          entryId: journalEntry.id,
          accountId: ledgerAccount.id,
          counterpartyId: journalEntry.lines[0].counterpartyId,
          sequenceOrder: 1,
          amount: {
            amount: 100_00,
            currencyCode: SYSTEM_CURRENCIES.NGN.code,
            isMinorUnit: true,
          },
          exchangeRate: null,
          functionalAmount: {
            amount: 100_00,
            currencyCode: SYSTEM_CURRENCIES.NGN.code,
            isMinorUnit: true,
          },
          side: EJournalSide.Debit,
          description: 'Debit cash',
          createdAt: journalEntry.createdAt,
          updatedAt: journalEntry.updatedAt,
          header: {
            sourceType: journalEntry.sourceType,
            memo: journalEntry.memo,
            status: journalEntry.status,
            effectiveDate: journalEntry.effectiveDate,
            postedAt: journalEntry.postedAt,
            voidedAt: journalEntry.voidedAt,
            voidingEntryId: journalEntry.voidingEntryId,
            createdBy: journalEntry.createdBy,
            createdAt: journalEntry.createdAt,
            updatedAt: journalEntry.updatedAt,
          },
          balanceEffect: ELedgerAccountBalanceEffect.Increase,
        },
      ],
      meta: {
        page: 2,
        limit: 25,
        total: 1,
        totalPages: 1,
      },
    });
    expect(result.data[0]).not.toHaveProperty('version');
    expect(result.data[0].header).not.toHaveProperty('version');
  });

  it('throws AccountNotFound when the account does not exist', async () => {
    const useCase = getUseCase();
    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    await expect(useCase(ledgerAccount.id, pagination)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(
      mockAccountTransactionQueryRepo.findAllByAccountId
    ).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the user cannot access the account', async () => {
    mockAccountingEntityService.validateAccess.mockImplementationOnce(() => {
      throw new appError.Forbidden();
    });
    const useCase = getUseCase();
    const [differentUser] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'different-owner@example.com',
      emailVerified: true,
      firstName: 'Different',
      lastName: 'Owner',
    });
    const inaccessibleAccount = {
      ...ledgerAccount,
      createdBy: differentUser.id,
    };

    mockLedgerAccountRepo.findById.mockResolvedValue(inaccessibleAccount);

    await expect(useCase(ledgerAccount.id, pagination)).rejects.toThrow(
      appError.Forbidden
    );

    expect(
      mockAccountTransactionQueryRepo.findAllByAccountId
    ).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntity when pagination is invalid', async () => {
    const useCase = getUseCase();
    const invalidPagination: IPaginationDto = { limit: 0 };

    await expect(useCase(ledgerAccount.id, invalidPagination)).rejects.toThrow(
      appError.UnprocessableEntity
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(
      mockAccountTransactionQueryRepo.findAllByAccountId
    ).not.toHaveBeenCalled();
  });
});
