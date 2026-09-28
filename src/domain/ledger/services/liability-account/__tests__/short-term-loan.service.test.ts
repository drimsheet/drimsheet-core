import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeShortTermLoanService from '@domain/ledger/services/liability-account/short-term-loan.service';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
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

describe('shortTermLoanAccountService', () => {
  const service = makeShortTermLoanService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const createdBy = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: createdBy,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as IAccountingEntity;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };

  const makeControlAccount = (
    behavior: string = ELiabilityAccountBehavior.DefaultShortTermDebt,
    overrides: Partial<ILedgerAccount> = {}
  ) =>
    ledgerAccountEntity.make<ILedgerAccount>({
      name: 'Short Term Debt',
      code: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.ShortTermDebt,
      behavior,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: createdBy,
      ...overrides,
    })[0];

  const shortTermLoanPayload = {
    name: 'Working Capital Loan',
    createdBy: createdBy,
    accountingEntityId: accountingEntity.id,
    currency: SYSTEM_CURRENCIES.USD,
    isControlAccount: false,
    controlAccountCode: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
  };

  const creditCardPayload = {
    name: 'Corporate Credit Card',
    createdBy: createdBy,
    accountingEntityId: accountingEntity.id,
    currency: SYSTEM_CURRENCIES.USD,
    isControlAccount: false,
    controlAccountCode: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
    meta: {
      cardIssuer: '  Visa  ',
      lastFourDigits: '4242',
      lastReconciliationDate: new Date('2026-03-01T00:00:00.000Z'),
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createHeader', () => {
    it('creates a frozen short-term-debt header when one does not exist', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

      const [account, events, audit] = await service.createHeader(
        {
          name: 'Short Term Debt',
          accountingEntity,
          createdBy: createdBy,
        },
        repoOptions
      );

      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
        accountingEntity.id,
        repoOptions
      );
      expect(account).toMatchObject({
        name: 'Short Term Debt',
        code: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
        materializedPath: LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT.HEADER,
        accountingEntityId: accountingEntity.id,
        normalBalance: ENormalBalance.Credit,
        type: ELedgerType.Liability,
        subType: ELiabilitySubType.ShortTermDebt,
        behavior: ELiabilityAccountBehavior.DefaultShortTermDebt,
        isControlAccount: true,
        controlAccountId: null,
        currency: SYSTEM_CURRENCIES.USD,
        meta: null,
        status: ELedgerAccountStatus.Active,
        contraAccountRule: EContraAccountRule.ContraPermitted,
        adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
        createdBy: createdBy,
      });
      expect(Object.isFrozen(account)).toBe(true);
      expect(events).toHaveLength(1);
      expect(audit.entityId).toBe(account.id);
    });

    it('rejects a duplicate short-term-debt header', async () => {
      const existingHeader = makeControlAccount();
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);

      await expect(
        service.createHeader(
          {
            name: 'Short Term Debt',
            accountingEntity,
            createdBy: createdBy,
          },
          repoOptions
        )
      ).rejects.toMatchObject({
        errorKey: 'ledger_error_header_account_already_exists_conflict',
        cause: { existingHeader },
      });
    });
  });

  describe('createSubAccount', () => {
    it.each([
      ELiabilityAccountBehavior.DefaultShortTermDebt,
      ELiabilityAccountBehavior.ShortTermLoan,
    ])(
      'creates a short-term loan under a %s control account',
      async (controlAccountBehavior) => {
        const controlAccount = makeControlAccount(controlAccountBehavior);
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
          id: generateUUID(),
          code: '200099',
          materializedPath: `${controlAccount.materializedPath}.200099`,
        });

        const [account, events, audit] = await service.createSubAccount(
          shortTermLoanPayload,
          repoOptions
        );

        expect(account).toMatchObject({
          name: shortTermLoanPayload.name,
          code: '200100',
          materializedPath: `${controlAccount.materializedPath}.200100`,
          accountingEntityId: accountingEntity.id,
          type: ELedgerType.Liability,
          subType: ELiabilitySubType.ShortTermDebt,
          behavior: ELiabilityAccountBehavior.ShortTermLoan,
          isControlAccount: false,
          controlAccountId: controlAccount.id,
          currency: SYSTEM_CURRENCIES.USD,
          meta: null,
          contraAccountRule: EContraAccountRule.ContraPermitted,
          adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
        });
        expect(events).toHaveLength(1);
        expect(audit.entityId).toBe(account.id);
      }
    );

    it('allocates the first sub-account code when no later account exists', async () => {
      const controlAccount = makeControlAccount();
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
      mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

      const [account] = await service.createSubAccount(
        shortTermLoanPayload,
        repoOptions
      );

      expect(account.code).toBe('200001');
      expect(account.materializedPath).toBe(
        `${controlAccount.materializedPath}.200001`
      );
    });

    it('creates a null-currency loan under a null-currency control account', async () => {
      const controlAccount = makeControlAccount(
        ELiabilityAccountBehavior.ShortTermLoan,
        { currency: null }
      );
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
      mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

      const [account] = await service.createSubAccount(
        { ...shortTermLoanPayload, currency: null },
        repoOptions
      );

      expect(account.currency).toBeNull();
    });

    it('rejects a fixed-currency loan under a null-currency control account', async () => {
      const controlAccount = makeControlAccount(
        ELiabilityAccountBehavior.ShortTermLoan,
        {
          controlAccountId: generateUUID(),
          currency: null,
        }
      );
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);

      await expect(
        service.createSubAccount(shortTermLoanPayload, repoOptions)
      ).rejects.toMatchObject({
        errorKey:
          'ledger_error_ledger_account_control_account_currency_mismatch_invalid',
        cause: {
          controlAccountId: controlAccount.id,
          controlAccountCode: controlAccount.code,
          controlAccountCurrencyCode: null,
          subAccountCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        },
      });
      expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledTimes(
        1
      );
    });

    it('rejects a different fixed currency under a nested control account', async () => {
      const controlAccount = makeControlAccount(
        ELiabilityAccountBehavior.ShortTermLoan,
        { controlAccountId: generateUUID() }
      );
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);

      await expect(
        service.createSubAccount(
          { ...shortTermLoanPayload, currency: SYSTEM_CURRENCIES.EUR },
          repoOptions
        )
      ).rejects.toMatchObject({
        errorKey:
          'ledger_error_ledger_account_control_account_currency_mismatch_invalid',
        cause: {
          controlAccountId: controlAccount.id,
          controlAccountCode: controlAccount.code,
          controlAccountCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          subAccountCurrencyCode: SYSTEM_CURRENCIES.EUR.code,
        },
      });
      expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledTimes(
        1
      );
    });

    it('rejects a missing control account', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

      await expect(
        service.createSubAccount(shortTermLoanPayload, repoOptions)
      ).rejects.toMatchObject({
        errorKey:
          'ledger_error_asset_account_control_account_not_found_unexpected',
      });
    });

    const invalidControlAccountCases: Array<{
      label: string;
      overrides: Partial<ILedgerAccount>;
    }> = [
      { label: 'type', overrides: { type: ELedgerType.Asset } },
      {
        label: 'subtype',
        overrides: { subType: ELiabilitySubType.Payable },
      },
      { label: 'control status', overrides: { isControlAccount: false } },
      {
        label: 'behavior',
        overrides: { behavior: ELiabilityAccountBehavior.CreditCard },
      },
    ];

    it.each(invalidControlAccountCases)(
      'rejects a control account with an invalid $label',
      async ({ overrides }) => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
          makeControlAccount(
            ELiabilityAccountBehavior.DefaultShortTermDebt,
            overrides
          )
        );

        await expect(
          service.createSubAccount(shortTermLoanPayload, repoOptions)
        ).rejects.toMatchObject({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
        });
        expect(
          mockLedgerAccountRepo.findLatestBySubType
        ).not.toHaveBeenCalled();
      }
    );
  });

  describe('createCreditCardSubAccount', () => {
    it.each([
      ELiabilityAccountBehavior.DefaultShortTermDebt,
      ELiabilityAccountBehavior.CreditCard,
    ])(
      'creates a credit card under a %s control account',
      async (controlAccountBehavior) => {
        const controlAccount = makeControlAccount(controlAccountBehavior);
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
        mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

        const [account, events, audit] =
          await service.createCreditCardSubAccount(
            creditCardPayload,
            repoOptions
          );

        expect(account).toMatchObject({
          name: creditCardPayload.name,
          code: '200001',
          materializedPath: `${controlAccount.materializedPath}.200001`,
          behavior: ELiabilityAccountBehavior.CreditCard,
          controlAccountId: controlAccount.id,
          meta: {
            cardIssuer: 'Visa',
            lastFourDigits: '4242',
            lastReconciliationDate: null,
          },
        });
        expect(Object.isFrozen(account.meta)).toBe(true);
        expect(events).toHaveLength(1);
        expect(audit.entityId).toBe(account.id);
      }
    );

    it('rejects a missing credit-card control account', async () => {
      mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

      await expect(
        service.createCreditCardSubAccount(creditCardPayload, repoOptions)
      ).rejects.toMatchObject({
        errorKey:
          'ledger_error_asset_account_control_account_not_found_unexpected',
      });
    });

    const invalidControlAccountCases: Array<{
      label: string;
      overrides: Partial<ILedgerAccount>;
    }> = [
      { label: 'type', overrides: { type: ELedgerType.Asset } },
      {
        label: 'subtype',
        overrides: { subType: ELiabilitySubType.Payable },
      },
      { label: 'control status', overrides: { isControlAccount: false } },
      {
        label: 'behavior',
        overrides: { behavior: ELiabilityAccountBehavior.ShortTermLoan },
      },
      { label: 'null currency', overrides: { currency: null } },
    ];

    it.each(invalidControlAccountCases)(
      'rejects a credit-card control account with an invalid $label',
      async ({ overrides }) => {
        mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
          makeControlAccount(
            ELiabilityAccountBehavior.DefaultShortTermDebt,
            overrides
          )
        );

        await expect(
          service.createCreditCardSubAccount(creditCardPayload, repoOptions)
        ).rejects.toMatchObject({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
        });
        expect(
          mockLedgerAccountRepo.findLatestBySubType
        ).not.toHaveBeenCalled();
      }
    );
  });
});
