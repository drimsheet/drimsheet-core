import makeAgentContextAppService from '@app/ai/services/agent-context.service';

import accountingRepos from '@infra/persistence/repos/accounting';
import agentRunContextRepo from '@infra/persistence/repos/ai/agent-run-context.repo.impl';
import userRepos from '@infra/persistence/repos/user';

export const agentContextAppService = makeAgentContextAppService({
  accountingEntityRepo: accountingRepos.accountingEntity,
  actorRepo: userRepos.actor,
  agentRunContextRepo,
});
