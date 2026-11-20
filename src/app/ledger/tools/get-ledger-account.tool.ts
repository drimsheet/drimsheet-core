import z from 'zod';

import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type makeGetLedgerAccountUseCase from '@app/ledger/usecases/get-ledger-account.usecase';

const inputSchema = z.object({
  accountId: z.uuid(new ledgerAccountError.InvalidId().errorKey),
});

interface IDependencies {
  usecase: ReturnType<typeof makeGetLedgerAccountUseCase>;
}

type TTool = IAgentTool<
  typeof inputSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_ledger_account';

const description =
  'Get one ledger account by accountId with enriched balances in the current accounting-entity context. Monetary results use minor units.';

export default function makeGetLedgerAccountTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: inputSchema,
    annotations: { readOnlyHint: true },
    func: (input) => deps.usecase(input.accountId as TEntityId),
  };
}
