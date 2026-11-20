import z from 'zod';

import dateError from '@shared/values/errors/date.error';

import accountingError from '@domain/accounting/errors/accounting.error';
import actorError from '@domain/user/errors/actor.error';

import agentContextAppError from '@app/ai/errors/agent-context.error';

import { IAgentRunContextDto } from './agent-run-context.dto';

const actorId = z.uuid(new actorError.InvalidId().errorKey);
const invalidName = new actorError.InvalidDisplayName().errorKey;
const actorName = z.string(invalidName).min(1, invalidName);
const timestamp = z.iso.datetime(new dateError.InvalidDate().errorKey);

export const agentRunContextDtoValidation = z.strictObject({
  id: z.uuid(new agentContextAppError.InvalidId().errorKey),
  accountingEntityId: z.uuid(
    new accountingError.InvalidAccountingEntityId().errorKey
  ),
  correlationId: z.uuid(
    new agentContextAppError.InvalidCorrelationId().errorKey
  ),
  agentActor: z.strictObject({ id: actorId, name: actorName }),
  delegatingActor: z.strictObject({ name: actorName, actorId }),
  initiatedOn: timestamp,
  completedOn: timestamp.nullable(),
}) satisfies z.ZodType<IAgentRunContextDto>;
