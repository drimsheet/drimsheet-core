import getEntitiesAndEventsHelper from '@shared/helpers/get-entities-and-events.helper';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
  TEntityWithEvents,
} from '@shared/values/events/types/event.types';
import { IEntityDelta } from '@shared/values/history/types/history.types';

describe('getEntitiesAndEventsHelper', () => {
  type TMockEntity = { id: number; name: string };
  type TMockEventData = TMockEntity;

  const mockEntity1: TMockEntity = { id: 1, name: 'Entity 1' };
  const mockEntity2: TMockEntity = { id: 2, name: 'Entity 2' };

  const mockEvent1: IEvent<TMockEventData> = {
    type: 'domain:mock:event-1',
    data: mockEntity1,
    occurredAt: new Date(),
    enrichedAt: null,
  };

  const mockEvent2: IEvent<TMockEventData> = {
    type: 'domain:mock:event-2',
    data: mockEntity2,
    occurredAt: new Date(),
    enrichedAt: null,
  };

  const mockEvent3: IEvent<TMockEventData> = {
    type: 'domain:mock:event-3',
    data: mockEntity2,
    occurredAt: new Date(),
    enrichedAt: null,
  };

  it('should correctly separate entities and events from the input data', () => {
    const data: TEntityWithEvents<TMockEntity, TMockEventData>[] = [
      [mockEntity1, [mockEvent1]],
      [mockEntity2, [mockEvent2, mockEvent3]],
    ];

    const result = getEntitiesAndEventsHelper(data);

    expect(result.entities).toHaveLength(2);
    expect(result.entities).toEqual([mockEntity1, mockEntity2]);

    expect(result.events).toHaveLength(3);
    expect(result.events).toEqual([mockEvent1, mockEvent2, mockEvent3]);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should handle tuples with empty event arrays', () => {
    const data: TEntityWithEvents<TMockEntity, TMockEventData>[] = [
      [mockEntity1, []],
      [mockEntity2, [mockEvent2]],
    ];

    const result = getEntitiesAndEventsHelper(data);

    expect(result.entities).toHaveLength(2);
    expect(result.entities).toEqual([mockEntity1, mockEntity2]);

    expect(result.events).toHaveLength(1);
    expect(result.events).toEqual([mockEvent2]);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should return empty arrays when given an empty input array', () => {
    const data: TEntityWithEvents<TMockEntity, TMockEventData>[] = [];

    const result = getEntitiesAndEventsHelper(data);

    expect(result.entities).toHaveLength(0);
    expect(result.entities).toEqual([]);

    expect(result.events).toHaveLength(0);
    expect(result.events).toEqual([]);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should handle audited entity tuples', () => {
    const audit: IEntityDelta<TMockEntity> = {
      entityId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      entityVersion: 1,
      action: 'created',
      diff: {
        before: null,
        after: mockEntity1,
      },
      occurredAt: new Date(),
    };
    const data: TAuditedEntity<TMockEntity, TMockEventData, TMockEntity>[] = [
      [mockEntity1, [mockEvent1], audit],
    ];

    const result = getEntitiesAndEventsHelper(data);

    expect(result.entities).toEqual([mockEntity1]);
    expect(result.events).toEqual([mockEvent1]);
  });
});
