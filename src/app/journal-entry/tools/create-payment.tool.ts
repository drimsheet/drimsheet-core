import { IAgentTool } from '@shared/types/ai.types';

import { paymentEntryJsonReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';
import type makeCreatePaymentUsecase from '@app/journal-entry/usecases/create-payment.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreatePaymentUsecase>;
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
