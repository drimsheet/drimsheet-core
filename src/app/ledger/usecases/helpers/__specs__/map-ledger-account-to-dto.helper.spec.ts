import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mapLedgerAccountToDto from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

describe('mapLedgerAccountToDto', () => {
  const mockUser = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    ownerId: mockUser,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  } as IAccountingEntity;
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  let mockAccount: ILedgerAccount;
  let controlAccount: ILedgerAccount;

  beforeAll(async () => {
    [controlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash',
        accountingEntity,
        createdBy: mockUser,
      },
      { correlationId: 'test-correlation-id' }
    );
    [mockAccount] = ((
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
      name: 'Petty Cash',
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      createdBy: mockUser,
      accountingEntity,
      controlAccount,
    });
  });

  it('returns DTO with zero balances when journalEntry is null', () => {
    const dto = mapLedgerAccountToDto(mockAccount, null, 'NGN');
    expect(dto.id).toBe(mockAccount.id);
    expect(dto.balance).toEqual({
      amount: 0,
      currencyCode: 'NGN',
      isMinorUnit: true,
    });
    expect(dto.functionalBalance).toEqual({
      amount: 0,
      currencyCode: 'NGN',
      isMinorUnit: true,
    });
  });

  it('uses functional currency for both zero balances of a null-currency account', () => {
    const dto = mapLedgerAccountToDto(
      { ...mockAccount, currency: null },
      null,
      SYSTEM_CURRENCIES.NGN.code
    );

    expect(dto.balance.currencyCode).toBe(SYSTEM_CURRENCIES.NGN.code);
    expect(dto.functionalBalance.currencyCode).toBe(SYSTEM_CURRENCIES.NGN.code);
  });

  it('uses a journal line functional amount as a null-currency account balance', () => {
    const nullCurrencyAccount: ILedgerAccount = {
      ...mockAccount,
      currency: null,
    };
    const exchangeRate = exchangeRateValue.make({
      baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
      targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      rate: 2,
      type: EExchangeRateType.Official,
      asOf: new Date('2026-08-08T00:00:00.000Z'),
      source: 'CBN',
    });
    const [journalEntry] = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Adjustment,
      effectiveDate: new Date('2026-08-08T00:00:00.000Z'),
      postedAt: null,
      memo: 'Null account mapping',
      createdBy: mockUser,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: nullCurrencyAccount.id,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
          amount: moneyValue.make(5000n, SYSTEM_CURRENCIES.USD, true),
          exchangeRate,
          sequenceOrder: 1,
          side: EJournalSide.Debit,
          description: 'Foreign amount',
        },
        {
          accountId: controlAccount.id,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
          amount: moneyValue.make(10000n, SYSTEM_CURRENCIES.NGN, true),
          exchangeRate: null,
          sequenceOrder: 2,
          side: EJournalSide.Credit,
          description: 'Functional offset',
        },
      ],
    });

    const dto = mapLedgerAccountToDto(
      nullCurrencyAccount,
      journalEntry,
      SYSTEM_CURRENCIES.NGN.code
    );

    expect(dto.balance).toEqual({
      amount: 10000,
      currencyCode: SYSTEM_CURRENCIES.NGN.code,
      isMinorUnit: true,
    });
    expect(dto.functionalBalance).toEqual(dto.balance);
  });
});
