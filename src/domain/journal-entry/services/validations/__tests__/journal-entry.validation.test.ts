import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import {
  ICreateReceiptEntryPayload,
  IJournalEntryLinePayload,
} from '@domain/journal-entry/types/journal-entry.service.types';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import {
  EAssetAccountBehavior,
  EAssetSubType,
  UAssetAccountBehavior,
} from '@domain/ledger/types/asset-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

describe('journalEntryServiceValidation', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(journalEntryServiceValidation)).toBe(true);
  });

  const accountingEntityId =
    '4b4c1064-a09e-4e4f-b6a3-23945cc87f74' as TEntityId;
  const sourceAccountId = '5b4c1064-a09e-4e4f-b6a3-23945cc87f75' as TEntityId;

  function makeSourceAccountBalance(amount: bigint) {
    const balance = ledgerAccountBalanceEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: sourceAccountId,
      accountingEntityId,
      accountMaterializedPath: '100001',
      currencyCode: SYSTEM_CURRENCIES.NGN.code,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    });

    return ledgerAccountBalanceEntity.adjust(balance, {
      ledgerAccountId: sourceAccountId,
      amount: moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true),
      functionalAmount: moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true),
      journalEntryId: '6b4c1064-a09e-4e4f-b6a3-23945cc87f76' as TEntityId,
      createdBy: '7b4c1064-a09e-4e4f-b6a3-23945cc87f77' as TEntityId,
    }).newBalance;
  }

  function makeTransferAccount(
    code: string,
    behavior: UAssetAccountBehavior
  ): ILedgerAccount {
    const type = ELedgerType.Asset;
    const [account] = ledgerAccountEntity.make({
      code,
      materializedPath: code,
      accountingEntityId,
      type,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior,
      normalBalance: getLedgerAccountNormalBalance(type),
      isControlAccount: false,
      controlAccountId: null,
      name: 'Transfer account',
      currency: SYSTEM_CURRENCIES.NGN,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      meta: {},
      createdBy: generateUUID(),
    });

    return account;
  }

  function makePayload(
    sourceCounterparties: (ICounterparty | null)[],
    destinationCounterparty: ICounterparty | null
  ): ICreateReceiptEntryPayload {
    return {
      attachments: [],
      header: {
        accountingEntityId,
        memo: null,
        effectiveDate: new Date('2026-08-03T10:00:00.000Z'),
        postedAt: null,
        functionalCurrencyCode: 'NGN',
        createdBy: accountingEntityId,
      },
      sourceLines: sourceCounterparties.map((counterparty) => ({
        counterparty,
      })) as unknown as ICreateReceiptEntryPayload['sourceLines'],
      destinationLine: {
        counterparty: destinationCounterparty,
      } as unknown as ICreateReceiptEntryPayload['destinationLine'],
    };
  }

  describe('validateAccounts', () => {
    const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
    const header = { accountingEntityId, effectiveDate, postedAt: null };
    const activeSource = makeTransferAccount(
      '100001',
      EAssetAccountBehavior.Bank
    );
    const activeDestination = makeTransferAccount(
      '100002',
      EAssetAccountBehavior.PettyCash
    );
    const amount = moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true);

    it.each([
      ['source', null],
      ['destination', null],
      ['source', effectiveDate],
      ['destination', effectiveDate],
    ] as const)(
      'rejects an archived %s for posting date %s',
      (side, postedAt) => {
        const archived = ledgerAccountEntity.archive(
          side === 'source' ? activeSource : activeDestination
        )[0];
        const lines = [
          { account: side === 'source' ? archived : activeSource, amount },
          {
            account: side === 'destination' ? archived : activeDestination,
            amount,
          },
        ];
        expect(() =>
          journalEntryServiceValidation.validateAccounts(
            { ...header, postedAt },
            lines
          )
        ).toThrow(
          new journalEntryError.ArchivedLedgerAccountNotAllowed({
            accounts: [{ id: archived.id, name: archived.name }],
          })
        );
      }
    );

    it.each(['source', 'destination'] as const)(
      'allows a draft %s account only when preparing a draft journal',
      (side) => {
        const [draft] = ledgerAccountEntity.make({
          ...(side === 'source' ? activeSource : activeDestination),
          status: ELedgerAccountStatus.Draft,
          controlAccountId: generateUUID(),
        });
        const lines = [
          { account: side === 'source' ? draft : activeSource, amount },
          {
            account: side === 'destination' ? draft : activeDestination,
            amount,
          },
        ];
        expect(() =>
          journalEntryServiceValidation.validateAccounts(header, lines)
        ).not.toThrow();
        expect(() =>
          journalEntryServiceValidation.validateAccounts(
            { ...header, postedAt: effectiveDate },
            lines
          )
        ).toThrow(
          new journalEntryError.DraftLedgerAccountNotAllowed({
            accounts: [{ id: draft.id, name: draft.name }],
          })
        );
      }
    );

    it('identifies every blocking account with the dedicated error key and cause', () => {
      const accounts = [activeSource, activeDestination].map(
        (account) =>
          ledgerAccountEntity.make({
            ...account,
            status: ELedgerAccountStatus.Draft,
            controlAccountId: generateUUID(),
          })[0]
      );
      const lines = accounts.map((account) => ({ account, amount }));
      expect.assertions(2);
      try {
        journalEntryServiceValidation.validateAccounts(
          { ...header, postedAt: effectiveDate },
          lines
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          journalEntryError.DraftLedgerAccountNotAllowed
        );
        expect(error).toMatchObject({
          errorKey:
            'journal_entry_error_draft_ledger_account_not_allowed_invalid',
          cause: { accounts: accounts.map(({ id, name }) => ({ id, name })) },
        });
      }
    });

    it('allows posting with active accounts including a currency-flexible account', () => {
      const [flexible] = ledgerAccountEntity.make({
        ...activeDestination,
        currency: null,
        openingBalanceDate: effectiveDate,
      });
      expect(() =>
        journalEntryServiceValidation.validateAccounts(
          { ...header, postedAt: effectiveDate },
          [
            { account: activeSource, amount },
            { account: flexible, amount },
          ]
        )
      ).not.toThrow();
    });

    it.each([
      [
        'ownership',
        { accountingEntityId: generateUUID() },
        journalEntryError.InvalidAccountingEntity,
      ],
      [
        'control account',
        { isControlAccount: true },
        journalEntryError.ControlAccountNotAllowed,
      ],
      [
        'opening date',
        { openingBalanceDate: new Date('2026-08-04T00:00:00.000Z') },
        journalEntryError.EffectiveDateIsBeforeOpeningDate,
      ],
      [
        'currency',
        { currency: SYSTEM_CURRENCIES.USD },
        journalEntryError.JournalLineAccountCurrencyMismatch,
      ],
    ] as const)(
      'still validates %s on draft journals with draft accounts',
      (_, overrides, errorType) => {
        const [account] = ledgerAccountEntity.make({
          ...activeSource,
          status: ELedgerAccountStatus.Draft,
          controlAccountId: generateUUID(),
          ...overrides,
        });
        expect(() =>
          journalEntryServiceValidation.validateAccounts(header, [
            { account, amount },
          ])
        ).toThrow(errorType);
      }
    );
  });

  describe('validateCounterparties', () => {
    it.each(['source', 'destination'] as const)(
      'rejects posting with a draft %s counterparty',
      (side) => {
        const [draft] = counterpartyEntity.make({
          createdBy: generateUUID(),
          accountingEntityId,
          name: 'Draft supplier',
          type: 'organization',
          status: 'draft',
        });
        const [active] = counterpartyEntity.make({
          createdBy: generateUUID(),
          accountingEntityId,
          name: 'Active supplier',
          type: 'individual',
        });
        const payload = makePayload(
          side === 'source' ? [active, draft] : [active],
          side === 'destination' ? draft : active
        );
        const lines = [...payload.sourceLines, payload.destinationLine];
        expect(() =>
          journalEntryServiceValidation.validateCounterparties(
            payload.header,
            lines
          )
        ).not.toThrow();
        payload.header.postedAt = payload.header.effectiveDate;
        expect(() =>
          journalEntryServiceValidation.validateCounterparties(
            payload.header,
            lines
          )
        ).toThrow(journalEntryError.DraftCounterpartyNotAllowed);
        try {
          journalEntryServiceValidation.validateCounterparties(
            payload.header,
            lines
          );
        } catch (error) {
          expect(error).toMatchObject({
            cause: { counterparties: [{ id: draft.id, name: draft.name }] },
          });
        }
      }
    );

    it('allows posting with active or absent counterparties', () => {
      const [active] = counterpartyEntity.make({
        createdBy: generateUUID(),
        accountingEntityId,
        name: 'Active supplier',
        type: 'individual',
      });
      const payload = makePayload([active, null], null);
      payload.header.postedAt = payload.header.effectiveDate;
      expect(() =>
        journalEntryServiceValidation.validateCounterparties(payload.header, [
          ...payload.sourceLines,
          payload.destinationLine,
        ])
      ).not.toThrow();
    });

    it('succeeds when all counterparties belong to the accounting entity', () => {
      const counterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
      } as ICounterparty;
      const payload = makePayload([counterparty, counterparty], counterparty);

      expect(() =>
        journalEntryServiceValidation.validateCounterparties(payload.header, [
          ...payload.sourceLines,
          payload.destinationLine,
        ])
      ).not.toThrow();
    });

    it('succeeds when every line has no counterparty', () => {
      const payload = makePayload([null, null], null);

      expect(() =>
        journalEntryServiceValidation.validateCounterparties(payload.header, [
          ...payload.sourceLines,
          payload.destinationLine,
        ])
      ).not.toThrow();
    });

    it('throws when a line counterparty does not belong to the accounting entity', () => {
      const invalidCounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId: 'different-entity-id' as TEntityId,
      } as ICounterparty;
      const payload = makePayload([null, invalidCounterparty], null);

      expect(() =>
        journalEntryServiceValidation.validateCounterparties(payload.header, [
          ...payload.sourceLines,
          payload.destinationLine,
        ])
      ).toThrow(journalEntryError.InvalidCounterpartyId);
    });

    it('throws when the destination counterparty does not belong to the accounting entity', () => {
      const invalidCounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId: 'different-entity-id' as TEntityId,
      } as ICounterparty;
      const payload = makePayload([null], invalidCounterparty);

      expect(() =>
        journalEntryServiceValidation.validateCounterparties(payload.header, [
          ...payload.sourceLines,
          payload.destinationLine,
        ])
      ).toThrow(journalEntryError.InvalidCounterpartyId);
    });
  });

  describe('validateSourceAccountBalance', () => {
    it('throws when the source account balance is missing', () => {
      const sourceAmount = moneyValue.make(
        10_000n,
        SYSTEM_CURRENCIES.NGN,
        true
      );

      expect(() =>
        journalEntryServiceValidation.validateSourceAccountBalance(
          sourceAccountId,
          sourceAmount,
          null
        )
      ).toThrow(journalEntryError.MissingSourceAccountBalance);
    });

    it('throws when the source amount is greater than the balance', () => {
      const sourceAmount = moneyValue.make(
        10_001n,
        SYSTEM_CURRENCIES.NGN,
        true
      );
      const sourceAccountBalance = makeSourceAccountBalance(10_000n);

      expect(() =>
        journalEntryServiceValidation.validateSourceAccountBalance(
          sourceAccountId,
          sourceAmount,
          sourceAccountBalance
        )
      ).toThrow(journalEntryError.InsufficientSourceAccountBalance);
    });

    it.each<[string, bigint]>([
      ['equal to', 10_000n],
      ['less than', 9_999n],
    ])('succeeds when the source amount is %s the balance', (_, amount) => {
      const sourceAmount = moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true);
      const sourceAccountBalance = makeSourceAccountBalance(10_000n);

      expect(() =>
        journalEntryServiceValidation.validateSourceAccountBalance(
          sourceAccountId,
          sourceAmount,
          sourceAccountBalance
        )
      ).not.toThrow();
    });
  });

  describe('validateTransferAccountComposition', () => {
    it('returns nothing for a valid transfer composition', () => {
      const sourceAccount = makeTransferAccount(
        '100001',
        EAssetAccountBehavior.Bank
      );
      const destinationAccount = makeTransferAccount(
        '100002',
        EAssetAccountBehavior.PettyCash
      );
      const destinationLine = {
        account: destinationAccount,
        counterparty: null,
      } as IJournalEntryLinePayload;

      expect(
        journalEntryServiceValidation.validateTransferAccountComposition(
          sourceAccount,
          [destinationLine]
        )
      ).toBeUndefined();
    });
  });
});
