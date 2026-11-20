import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';
import actorError from '@domain/user/errors/actor.error';

import agentContextAppError from '@app/ai/errors/agent-context.error';

import { ICreateAgentRunContextDto } from './agent-run-context.dto';

export const agentRunContextIdentifiersValidation = z.strictObject({
  accountingEntityId: z.uuid(
    new accountingError.InvalidAccountingEntityId().errorKey
  ),
  correlationId: z.uuid(
    new agentContextAppError.InvalidCorrelationId().errorKey
  ),
  delegatingActorId: z.uuid(new actorError.InvalidId().errorKey),
});

const invalidUsername = new actorError.InvalidUsername().errorKey;

export const createAgentRunContextDtoValidation =
  agentRunContextIdentifiersValidation.extend({
    agentActorUsername: z.string(invalidUsername).min(1, invalidUsername),
  }) satisfies z.ZodType<ICreateAgentRunContextDto>;
