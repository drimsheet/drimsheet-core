import makeAgentContextAppService from '@app/ai/services/agent-context.service';

import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';

export const agentContextAppService = makeAgentContextAppService({
  accountingEntityRepo: accountingRepos.accountingEntity,
  actorRepo: userRepos.actor,
});
