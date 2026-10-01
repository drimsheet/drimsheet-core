import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryRuleValidator from '@domain/journal-entry/rules/entry-rule.validator';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
import receiptEntryRule from '@domain/journal-entry/rules/receipt-entry.rule';
import transferEntryRule, {
  transferBankChargeDestinationPermit,
} from '@domain/journal-entry/rules/transfer-entry.rule';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeReceivablesAccountService from '@domain/ledger/services/asset-account/receivables-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
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
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

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

describe('journal entry rules', () => {
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const currency = SYSTEM_CURRENCIES.NGN;

  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: accountingEntityId,
    ownerId: createdBy,
    functionalCurrencyCode: currency.code,
  } as IAccountingEntity;
  const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAllByIds: jest.fn(),
    findAllByMaterializedPath: jest.fn(),
    findByCode: jest.fn(),
    findBySubType: jest.fn(),
    findByBehavior: jest.fn(),
    findLatestBySubType: jest.fn(),
    findAll: jest.fn(),
  };
  const cashAccountService = makeCashAccountService({ ledgerAccountRepo });
  const receivablesAccountService = makeReceivablesAccountService({
    ledgerAccountRepo,
  });
  const payablesAccountService = makePayablesAccountService({
    ledgerAccountRepo,
  });
  const equityAccountService = makeEquityAccountService({ ledgerAccountRepo });
  const servicesAccountService = makeServicesAccountService({
    ledgerAccountRepo,
  });
  const repoOptions = { correlationId: 'test-correlation-id' };
  let cashAccount: ILedgerAccount;
  let receivableAccount: ILedgerAccount;
  let liabilityAccount: ILedgerAccount;
  let openingBalanceEquityAccount: ILedgerAccount;
  let revenueAccount: ILedgerAccount;

  beforeAll(async () => {
    [cashAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash on Hand',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    [receivableAccount] = await receivablesAccountService.createHeader(
      {
        name: 'Receivables',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    [liabilityAccount] = await payablesAccountService.createHeader(
      {
        name: 'Accounts Payable',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );

    [openingBalanceEquityAccount] =
      await equityAccountService.createOpeningBalanceAccount(
        {
          name: 'Opening Balance Equity',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      );

    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    [revenueAccount] = await servicesAccountService.createHeader(
      {
        name: 'Service Revenue',
        accountingEntity,
        createdBy: createdBy,
      },
      repoOptions
    );
  });

  describe('openingBalanceEntryRule', () => {
    it('permits any source account', () => {
      expect(
        journalEntryRuleValidator(cashAccount, openingBalanceEntryRule.source)
      ).toBe(true);

      expect(
        journalEntryRuleValidator(
          revenueAccount,
          openingBalanceEntryRule.source
        )
      ).toBe(true);
    });

    it('permits only opening balance equity as the destination account', () => {
      expect(
        journalEntryRuleValidator(
          openingBalanceEquityAccount,
          openingBalanceEntryRule.destination
        )
      ).toBe(true);

      expect(
        journalEntryRuleValidator(
          cashAccount,
          openingBalanceEntryRule.destination
        )
      ).toBe(false);
    });
  });

  describe('receiptEntryRule', () => {
    it('permits revenue and liability accounts as source accounts', () => {
      expect(
        journalEntryRuleValidator(revenueAccount, receiptEntryRule.source)
      ).toBe(true);

      expect(
        journalEntryRuleValidator(liabilityAccount, receiptEntryRule.source)
      ).toBe(true);
    });

    it('rejects non-revenue and non-liability accounts as source accounts', () => {
      expect(
        journalEntryRuleValidator(cashAccount, receiptEntryRule.source)
      ).toBe(false);
    });

    it('permits only cash and cash equivalent accounts as destination accounts', () => {
      expect(
        journalEntryRuleValidator(cashAccount, receiptEntryRule.destination)
      ).toBe(true);

      expect(
        journalEntryRuleValidator(
          receivableAccount,
          receiptEntryRule.destination
        )
      ).toBe(false);
    });
  });

  describe('paymentEntryRule', () => {
    it.each([
      [EAssetAccountBehavior.Bank, ELedgerType.Asset],
      [EAssetAccountBehavior.PettyCash, ELedgerType.Asset],
      [ELiabilityAccountBehavior.CreditCard, ELedgerType.Liability],
    ])('permits %s as a source account', (behavior, type) => {
      const account = makePaymentAccount({
        behavior,
        type,
        subType:
          type === ELedgerType.Asset
            ? EAssetSubType.CashAndCashEquivalent
            : ELiabilitySubType.ShortTermDebt,
      });

      expect(journalEntryRuleValidator(account, paymentEntryRule.source)).toBe(
        true
      );
    });

    it('rejects an unpermitted source behavior', () => {
      const account = makePaymentAccount({
        behavior: EAssetAccountBehavior.DefaultCash,
      });

      expect(journalEntryRuleValidator(account, paymentEntryRule.source)).toBe(
        false
      );
    });

    it.each([
      [ELiabilitySubType.Payable, ELedgerType.Liability],
      [ELiabilitySubType.LongTermLoan, ELedgerType.Liability],
      [EExpenseSubType.DirectCosts, ELedgerType.Expense],
      [EExpenseSubType.Interest, ELedgerType.Expense],
    ])('permits %s as a destination account', (subType, type) => {
      const account = makePaymentAccount({ subType, type });

      expect(
        journalEntryRuleValidator(account, paymentEntryRule.destination)
      ).toBe(true);
    });

    it('rejects an unpermitted destination subtype', () => {
      const account = makePaymentAccount({
        subType: EAssetSubType.CashAndCashEquivalent,
      });

      expect(
        journalEntryRuleValidator(account, paymentEntryRule.destination)
      ).toBe(false);
    });
  });

  describe('transferEntryRule', () => {
    it.each([EAssetAccountBehavior.Bank, EAssetAccountBehavior.PettyCash])(
      'permits %s as a source account',
      (behavior) => {
        const account = makePaymentAccount({ behavior });

        expect(
          journalEntryRuleValidator(account, transferEntryRule.source)
        ).toBe(true);
      }
    );

    it('rejects an unpermitted source behavior', () => {
      const account = makePaymentAccount({
        behavior: EAssetAccountBehavior.DefaultCash,
      });

      expect(journalEntryRuleValidator(account, transferEntryRule.source)).toBe(
        false
      );
    });

    it.each([EAssetAccountBehavior.Bank, EAssetAccountBehavior.PettyCash])(
      'permits %s as a destination account',
      (behavior) => {
        const account = makePaymentAccount({ behavior });

        expect(
          journalEntryRuleValidator(account, transferEntryRule.destination)
        ).toBe(true);
      }
    );

    it('rejects a non-cash destination account', () => {
      const account = makePaymentAccount({
        behavior: EAssetAccountBehavior.TradeReceivable,
        subType: EAssetSubType.Receivables,
      });

      expect(
        journalEntryRuleValidator(account, transferEntryRule.destination)
      ).toBe(false);
    });

    it('keeps Bank Charge accounts out of the primary destination permit', () => {
      const account = makePaymentAccount({
        type: ELedgerType.Expense,
        subType: EExpenseSubType.BankCharge,
        behavior: EExpenseAccountBehavior.BankCharge,
      });

      expect(
        journalEntryRuleValidator(account, transferEntryRule.destination)
      ).toBe(false);
    });

    it('permits only exact Bank Charge accounts as additional destinations', () => {
      const bankChargeAccount = makePaymentAccount({
        type: ELedgerType.Expense,
        subType: EExpenseSubType.BankCharge,
        behavior: EExpenseAccountBehavior.BankCharge,
      });
      const otherExpenseAccount = makePaymentAccount({
        type: ELedgerType.Expense,
        subType: EExpenseSubType.RentAndUtilities,
        behavior: EExpenseAccountBehavior.RentAndUtilities,
      });

      expect(
        journalEntryRuleValidator(
          bankChargeAccount,
          transferBankChargeDestinationPermit
        )
      ).toBe(true);
      expect(
        journalEntryRuleValidator(
          otherExpenseAccount,
          transferBankChargeDestinationPermit
        )
      ).toBe(false);
      expect(
        journalEntryRuleValidator(
          cashAccount,
          transferBankChargeDestinationPermit
        )
      ).toBe(false);
    });
  });
});
