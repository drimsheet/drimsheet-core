import { IAgentTool } from '@app/ai/types/agent-tool';
import { transferEntryJsonReqValidation } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto.validation';
import type makeCreateTransferUsecase from '@app/journal-entry/usecases/create-transfer.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateTransferUsecase>;
}

type TTool = IAgentTool<
  typeof transferEntryJsonReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_transfer';

const description =
  'Create a transfer journal entry in the current accounting-entity context using source and destination lines with optional charge lines. Supply dates as ISO timestamps and money with its isMinorUnit flag.';

export default function makeCreateTransferTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: transferEntryJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
