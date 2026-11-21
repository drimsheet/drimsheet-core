import makeCreateAgentRunContextUsecase from '@app/ai/usecases/create-agent-run-context.usecase';
import makeProposeJournalEntriesUsecase from '@app/ai/usecases/propose-journal-entries.usecase';

import makeJournalEntryLlmProposer from '@infra/ai/structured-calls/journal-entry-proposer/journal-entry-proposer';
import { agentContextAppService } from '@infra/ioc/services/ai';
import { fileStorageClient, pdfService } from '@infra/ioc/services/file';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import agentRunContextRepo from '@infra/persistence/repos/ai/agent-run-context.repo.impl';
import proposedJournalEntriesRepo from '@infra/persistence/repos/ai/proposed-journal-entries.repo.impl';

export const createAgentRunContextUseCase = makeTracedUseCase(
  'ai.createAgentRunContextUseCase',
  makeCreateAgentRunContextUsecase({
    agentContextAppService,
    agentRunContextRepo,
  })
);

export const proposeJournalEntriesUseCase = makeTracedUseCase(
  'ai.proposeJournalEntriesUseCase',
  makeProposeJournalEntriesUsecase({
    agentContextAppService,
    agentRunContextRepo,
    journalEntryProposalsRepo: proposedJournalEntriesRepo,
    fileStorageClient,
    pdfService,
    structuredLlmCall: makeJournalEntryLlmProposer(fileStorageClient),
  })
);
