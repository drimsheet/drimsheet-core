import { TEntityId } from '@shared/types/uuid';

import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';

import chartOfAccountsMapper from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.mapper';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const now = new Date('2026-10-15T10:00:00Z');
const account: ILedgerAccountDto = {
  id: accountId,
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId,
  type: ELedgerType.Asset,
  normalBalance: ENormalBalance.Debit,
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  isControlAccount: false,
  name: 'Operating Bank',
  status: ELedgerAccountStatus.Active,
  contraAccountRule: EContraAccountRule.ContraPermitted,
  adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
  openingBalanceDate: null,
  createdBy: userId,
  createdAt: now,
  updatedAt: now,
  balance: { amount: 10000, currencyCode: 'USD', isMinorUnit: true },
  functionalBalance: {
    amount: 10000,
    currencyCode: 'USD',
    isMinorUnit: true,
  },
} satisfies ILedgerAccountDto;

describe('chartOfAccountsMapper.toDto', () => {
  const header = {
    ...account,
    name: 'Cash header',
    id: '123e4567-e89b-12d3-a456-426614174010' as TEntityId,
    isControlAccount: true,
  };
  const control = {
    ...account,
    name: 'Bank Accounts',
    id: '123e4567-e89b-12d3-a456-426614174011' as TEntityId,
    controlAccountId: header.id,
    isControlAccount: true,
    status: ELedgerAccountStatus.Draft,
  };
  const leaf = {
    ...account,
    id: '123e4567-e89b-12d3-a456-426614174012' as TEntityId,
    controlAccountId: control.id,
    status: ELedgerAccountStatus.Draft,
  };
  const sibling = {
    ...account,
    name: 'Petty Cash',
    id: '123e4567-e89b-12d3-a456-426614174013' as TEntityId,
    controlAccountId: header.id,
    status: ELedgerAccountStatus.Archived,
  };
  const rootPostingAccount = {
    ...account,
    name: 'Bank Suspense',
    id: '123e4567-e89b-12d3-a456-426614174014' as TEntityId,
    isControlAccount: false,
  };
  const accounts = [header, control, leaf, sibling, rootPostingAccount];

  describe('search', () => {
    const savings = {
      ...leaf,
      id: '123e4567-e89b-12d3-a456-426614174015' as TEntityId,
      name: 'Savings',
    };
    const searchableAccounts = [
      header,
      control,
      leaf,
      savings,
      sibling,
      rootPostingAccount,
    ];

    it('returns topmost partial matches across branches, retaining matching and nonmatching descendants', () => {
      expect(
        chartOfAccountsMapper.toDto(searchableAccounts, false, 'bAnK')
      ).toEqual([
        {
          ...control,
          children: [
            { ...leaf, children: [] },
            { ...savings, children: [] },
          ],
        },
        { ...rootPostingAccount, children: [] },
      ]);
      expect(searchableAccounts.every((node) => !('children' in node))).toBe(
        true
      );
    });

    it('returns a matching leaf without its nonmatching ancestors', () => {
      expect(chartOfAccountsMapper.toDto(accounts, false, 'operating')).toEqual(
        [{ ...leaf, children: [] }]
      );
    });

    it('keeps a matching header with its full subtree', () => {
      expect(chartOfAccountsMapper.toDto(accounts, false, 'cash')).toEqual([
        {
          ...header,
          children: [
            { ...control, children: [{ ...leaf, children: [] }] },
            { ...sibling, children: [] },
          ],
        },
      ]);
    });

    it('ignores matching headers and searches their descendants when headers are omitted', () => {
      expect(chartOfAccountsMapper.toDto(accounts, true, 'cash')).toEqual([
        { ...sibling, children: [] },
      ]);
      expect(
        chartOfAccountsMapper.toDto(accounts, true, 'cash header')
      ).toEqual([]);
      expect(
        chartOfAccountsMapper.toDto(accounts, true, 'bank suspense')
      ).toEqual([]);
    });

    it.each([false, true])(
      'preserves the full eligible tree for an empty search with omission=%s',
      (omit) => {
        expect(chartOfAccountsMapper.toDto(accounts, omit, '')).toEqual(
          chartOfAccountsMapper.toDto(accounts, omit)
        );
      }
    );

    it.each(['missing', '100001', '.*', '%', '_'])(
      'returns no matches for %s using literal account-name matching',
      (search) => {
        expect(chartOfAccountsMapper.toDto(accounts, false, search)).toEqual(
          []
        );
      }
    );

    it('returns an empty tree when searching an empty class', () => {
      expect(chartOfAccountsMapper.toDto([], false, 'bank')).toEqual([]);
    });
  });

  it('maps every field and preserves multiple roots, sibling order, statuses and nested descendants', () => {
    expect(chartOfAccountsMapper.toDto(accounts)).toEqual([
      {
        ...header,
        children: [
          { ...control, children: [{ ...leaf, children: [] }] },
          { ...sibling, children: [] },
        ],
      },
      { ...rootPostingAccount, children: [] },
    ]);
    expect(accounts.every((node) => !('children' in node))).toBe(true);
  });

  it('omits only parentless accounts, retaining nested controls and original parent IDs', () => {
    expect(chartOfAccountsMapper.toDto(accounts, true)).toEqual([
      { ...control, children: [{ ...leaf, children: [] }] },
      { ...sibling, children: [] },
    ]);
  });

  it('assembles children even when they precede their parents', () => {
    expect(chartOfAccountsMapper.toDto([leaf, control, header], false)).toEqual(
      [
        {
          ...header,
          children: [{ ...control, children: [{ ...leaf, children: [] }] }],
        },
      ]
    );
  });

  it.each([false, true])(
    'returns an empty tree for empty input with omission=%s',
    (omit) => {
      expect(chartOfAccountsMapper.toDto([], omit)).toEqual([]);
    }
  );

  it('returns an empty tree when all accounts are parentless and headers are omitted', () => {
    expect(
      chartOfAccountsMapper.toDto([header, rootPostingAccount], true)
    ).toEqual([]);
  });
});
