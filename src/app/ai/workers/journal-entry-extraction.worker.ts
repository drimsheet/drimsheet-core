import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

interface IDependencies {
  agentContextAppService: IAgentContextAppService;
}

export default function makeJournalEntryExtractionWorker(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto): Promise<void> => {
    zodValidationRunner(journalEntryExtractionDtoValidation, payload);

    const { accountingEntityId, correlationId, delegatingActorId } =
      payload.context;

    await deps.agentContextAppService.createRunContext(
      {
        accountingEntityId: accountingEntityId as TEntityId,
        correlationId: correlationId as TEntityId,
        delegatingActorId: delegatingActorId as TEntityId,
        agentActorUsername: 'drimsheet-core-ai',
      },
      { correlationId }
    );

    // TODO: Start the journal-entry extraction workflow.
  };
}
