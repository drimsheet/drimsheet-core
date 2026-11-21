import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

interface IDependencies {
  usecase: (payload: ICreateExpenseAccountDto) => Promise<ILedgerAccountDto>;
}

type TTool = IAgentTool<
  typeof createExpenseAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_expense_account';

const description =
  'Create an expense ledger account in the current accounting-entity context. Specify its name, supported expense behavior, and control-account settings.';

export default function makeCreateExpenseAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createExpenseAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
