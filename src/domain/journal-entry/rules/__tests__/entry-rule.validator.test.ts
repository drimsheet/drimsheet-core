import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryRuleValidator from '@domain/journal-entry/rules/entry-rule.validator';
import { IJournalEntryRulePermits } from '@domain/journal-entry/types/entry.rules.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('journalEntryRuleValidator', () => {
  const userId = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: userId,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
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
  let account: ILedgerAccount;

  beforeAll(async () => {
    [account] = await cashAccountService.createHeader(
      {
        name: 'Cash on Hand',
        createdBy: userId,
        accountingEntity,
      },
      { correlationId: 'test-correlation-id' }
    );
  });

  it('permits an account when all restrictions are wildcards', () => {
    const permits: IJournalEntryRulePermits = {
      permittedTypes: '*',
      permittedSubTypes: '*',
      permittedBehaviors: '*',
    };

    expect(journalEntryRuleValidator(account, permits)).toBe(true);
  });

  it('permits an account when all of its attributes are explicitly permitted', () => {
    const permits: IJournalEntryRulePermits = {
      permittedTypes: new Set([ELedgerType.Asset]),
      permittedSubTypes: new Set([EAssetSubType.CashAndCashEquivalent]),
      permittedBehaviors: new Set([EAssetAccountBehavior.DefaultCash]),
    };

    expect(journalEntryRuleValidator(account, permits)).toBe(true);
  });

  it('rejects an account with a non-permitted type', () => {
    const permits: IJournalEntryRulePermits = {
      permittedTypes: new Set([ELedgerType.Revenue]),
      permittedSubTypes: '*',
      permittedBehaviors: '*',
    };

    expect(journalEntryRuleValidator(account, permits)).toBe(false);
  });

  it('rejects an account with a non-permitted subtype', () => {
    const permits: IJournalEntryRulePermits = {
      permittedTypes: '*',
      permittedSubTypes: new Set([EAssetSubType.Receivables]),
      permittedBehaviors: '*',
    };

    expect(journalEntryRuleValidator(account, permits)).toBe(false);
  });

  it('rejects an account with a non-permitted behavior', () => {
    const permits: IJournalEntryRulePermits = {
      permittedTypes: '*',
      permittedSubTypes: '*',
      permittedBehaviors: new Set([EAssetAccountBehavior.PettyCash]),
    };

    expect(journalEntryRuleValidator(account, permits)).toBe(false);
  });
});
