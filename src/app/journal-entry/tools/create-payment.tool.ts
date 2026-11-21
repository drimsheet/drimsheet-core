import { IAgentTool } from '@app/ai/types/agent-tool';
import type { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import type { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import { paymentEntryJsonReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';

interface IDependencies {
  usecase: (payload: IPaymentEntryReq) => Promise<IJournalEntryDto>;
}

type TTool = IAgentTool<
  typeof paymentEntryJsonReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_payment';

const description =
  'Create a payment journal entry in the current accounting-entity context using one source line and destination lines. Supply dates as ISO timestamps, money with its isMinorUnit flag, and existing attachment references when needed.';

export default function makeCreatePaymentTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: paymentEntryJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
