import { IAgentTool } from '@app/ai/types/agent-tool';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import type makeCreateExpenseAccountUsecase from '@app/ledger/usecases/create-expense-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateExpenseAccountUsecase>;
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
