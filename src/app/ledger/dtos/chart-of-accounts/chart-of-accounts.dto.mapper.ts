import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

import { IChartOfAccountsNodeDto } from './chart-of-accounts.dto';

/** Keep the first matching node on each branch with its complete subtree. */
function findMatchingRoots(
  nodes: IChartOfAccountsNodeDto[],
  search: string
): IChartOfAccountsNodeDto[] {
  return nodes.flatMap((node) => {
    if (node.name.toLowerCase().includes(search)) {
      return [node];
    }

    return findMatchingRoots(node.children, search);
  });
}

const chartOfAccountsMapper = {
  /**
   * Assemble a complete class into a tree, preserving input sibling order.
   * Ledger invariants guarantee that every non-root parent is in this class.
   * Omitting headers promotes their children without changing account metadata.
   * Search selects topmost matching roots after header omission and retains
   * every descendant of a matching root, regardless of its name.
   */
  toDto(
    accounts: ILedgerAccountDto[],
    omitHeaderAccounts = false,
    search?: string
  ): IChartOfAccountsNodeDto[] {
    const nodes = new Map(
      accounts.map((account) => {
        const node: IChartOfAccountsNodeDto = {
          id: account.id,
          code: account.code,
          materializedPath: account.materializedPath,
          accountingEntityId: account.accountingEntityId,
          type: account.type,
          normalBalance: account.normalBalance,
          subType: account.subType,
          behavior: account.behavior,
          isControlAccount: account.isControlAccount,
          controlAccountId: account.controlAccountId,
          name: account.name,
          status: account.status,
          contraAccountRule: account.contraAccountRule,
          adjunctAccountRule: account.adjunctAccountRule,
          openingBalanceDate: account.openingBalanceDate,
          createdBy: account.createdBy,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          deletedAt: account.deletedAt,
          balance: account.balance,
          functionalBalance: account.functionalBalance,
          children: [],
        };
        return [account.id, node];
      })
    );
    const roots: IChartOfAccountsNodeDto[] = [];

    for (const node of nodes.values()) {
      if (node.controlAccountId == null) {
        roots.push(node);
      } else {
        nodes.get(node.controlAccountId)!.children.push(node);
      }
    }

    const eligibleRoots = omitHeaderAccounts
      ? roots.flatMap((root) => root.children)
      : roots;
    const normalizedSearch = search?.toLowerCase() ?? '';

    if (normalizedSearch === '') {
      return eligibleRoots;
    }

    return findMatchingRoots(eligibleRoots, normalizedSearch);
  },
};

export default chartOfAccountsMapper;
