import { sql } from 'drizzle-orm';

import IAssetLiabilityAccountParticipationQueryRepo, {
  IAssetLiabilityAccountBalance,
} from '@app/reporting/contracts/asset-liability-account-participation.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAccountRow extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  type: IAssetLiabilityAccountBalance['type'];
  sub_type: string;
  status: IAssetLiabilityAccountBalance['status'];
  is_control_account: boolean;
  control_account_id: string | null;
  functional_balance: string | null;
}

const assetLiabilityAccountParticipationQueryRepo: IAssetLiabilityAccountParticipationQueryRepo =
  {
    async findAll(accountingEntityId, currencyCode, options) {
      const accounts = await getDbQuery(options).execute<IAccountRow>(sql`
      SELECT account.id::text, account.name, account.code, account.type::text,
        account.sub_type, account.status::text, account.is_control_account,
        account.control_account_id::text,
        balance.functional_amount::text AS functional_balance
      FROM core.ledger_accounts AS account
      LEFT JOIN core.ledger_account_balances AS balance
        ON balance.ledger_account_id = account.id
        AND balance.accounting_entity_id = account.accounting_entity_id
        AND balance.functional_currency_code = ${currencyCode}
      WHERE account.accounting_entity_id = ${accountingEntityId}::uuid
        AND account.type IN ('asset', 'liability')
        AND (account.is_control_account = false
          OR account.control_account_id IS NULL)
      ORDER BY account.code, account.id
    `);

      return accounts.rows.map((account) => ({
        accountId: account.id,
        accountName: account.name,
        code: account.code,
        type: account.type,
        subType: account.sub_type,
        status: account.status,
        isControlAccount: account.is_control_account,
        controlAccountId: account.control_account_id,
        functionalBalance:
          account.functional_balance === null
            ? null
            : BigInt(account.functional_balance),
      }));
    },
  };

export default assetLiabilityAccountParticipationQueryRepo;
