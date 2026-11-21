import { IAgentTool } from '@app/ai/types/agent-tool';
import type { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import type { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { receiptEntryJsonReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';

interface IDependencies {
  usecase: (payload: IReceiptEntryReq) => Promise<IJournalEntryDto>;
}

type TTool = IAgentTool<
  typeof receiptEntryJsonReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_receipt';

const description =
  'Create a receipt journal entry in the current accounting-entity context using source lines and one destination line. Supply dates as ISO timestamps, money with its isMinorUnit flag, and existing attachment references when needed.';

export default function makeCreateReceiptTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: receiptEntryJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
