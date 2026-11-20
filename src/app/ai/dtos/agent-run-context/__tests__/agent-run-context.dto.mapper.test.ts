import generateUUID from '@shared/utils/uuid-generator';

import agentRunContextDtoMapper from '@app/ai/dtos/agent-run-context/agent-run-context.dto.mapper';
import { agentRunContextDtoValidation } from '@app/ai/dtos/agent-run-context/agent-run-context.dto.validation';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

describe('agentRunContextDtoMapper.toDto', () => {
  const context: IAgentRunContext = {
    id: generateUUID(),
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: new Date('2026-11-20T10:00:00Z'),
    completedOn: null,
  };

  it.each([
    [null, null],
    [new Date('2026-11-20T10:01:00Z'), '2026-11-20T10:01:00.000Z'],
  ] as const)(
    'serializes a context with completion time %s',
    (completedOn, expected) => {
      const dto = agentRunContextDtoMapper.toDto({ ...context, completedOn });
      expect(dto).toEqual({
        ...context,
        initiatedOn: '2026-11-20T10:00:00.000Z',
        completedOn: expected,
      });
      expect(agentRunContextDtoValidation.parse(dto)).toEqual(dto);
    }
  );
});
