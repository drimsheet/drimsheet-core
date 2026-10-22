import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import { EReportingContextEvents } from '@domain/accounting/events/reporting-context.events';
import { EReportingContextActions } from '@domain/accounting/types/reporting-context-audit.types';

function makePayload(): Parameters<typeof reportingContextEntity.make>[0] {
  return {
    createdBy: generateUUID(),
    name: '  Primary context  ',
    description: '  Context description  ',
    accountingEntityId: generateUUID(),
    accountingContextId: generateUUID(),
    reportingCurrencyCode: 'NGN',
    reportingIntervalId: generateUUID(),
  };
}

describe('reportingContextEntity interval references', () => {
  const timestamp = new Date('2026-01-01T12:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(timestamp);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates only the new context shape, with matching event and audit', () => {
    const payload = makePayload();
    const [context, events, audit] = reportingContextEntity.make(payload);
    expect(context).toEqual({
      ...payload,
      name: 'Primary context',
      description: 'Context description',
      id: expect.any(String),
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EReportingContextEvents.Created,
      data: context,
    });
    expect(audit).toEqual({
      entityId: context.id,
      entityVersion: 1,
      action: EReportingContextActions.Created,
      diff: { before: null, after: context },
      occurredAt: timestamp,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.createdAt)).toBe(true);
    expect(Object.isFrozen(context.updatedAt)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);
    expect(Object.isFrozen(reportingContextEntity)).toBe(true);
  });

  it('supports a null description', () => {
    const [context] = reportingContextEntity.make({
      ...makePayload(),
      description: null,
    });
    expect(context.description).toBeNull();
  });

  it.each([
    ['createdBy', accountingError.InvalidCreatedBy],
    ['accountingEntityId', accountingError.InvalidAccountingEntityId],
    ['accountingContextId', accountingError.InvalidAccountingContextId],
    ['reportingIntervalId', accountingError.InvalidReportingIntervalId],
  ] as const)('rejects an invalid %s on creation', (field, error) => {
    expect(() =>
      reportingContextEntity.make({
        ...makePayload(),
        [field]: 'bad' as TEntityId,
      })
    ).toThrow(error);
  });

  it.each([
    ['name', '', accountingError.InvalidName],
    ['name', ' '.repeat(5), accountingError.InvalidName],
    ['name', 'x'.repeat(151), accountingError.InvalidName],
    ['description', '', accountingError.InvalidDescription],
    ['description', 'x'.repeat(256), accountingError.InvalidDescription],
  ] as const)('rejects invalid %s content', (field, value, error) => {
    expect(() =>
      reportingContextEntity.make({ ...makePayload(), [field]: value })
    ).toThrow(error);
  });

  it('rejects an invalid reporting currency', () => {
    expect(() =>
      reportingContextEntity.make({
        ...makePayload(),
        reportingCurrencyCode: 'INVALID' as never,
      })
    ).toThrow();
  });

  it('changes the interval reference with an event and audit, preserving identity', () => {
    const [context] = reportingContextEntity.make(makePayload());
    const intervalId = generateUUID();
    jest.setSystemTime(new Date('2026-02-01'));
    const [updated, events, audit] = reportingContextEntity.update(context, {
      reportingIntervalId: intervalId,
    });
    expect(updated).toEqual({
      ...context,
      reportingIntervalId: intervalId,
      updatedAt: new Date('2026-02-01'),
    });
    expect(context.reportingIntervalId).not.toBe(intervalId);
    expect(updated.createdAt).toBe(context.createdAt);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.updatedAt)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EReportingContextEvents.Updated,
      data: updated,
    });
    expect(audit).toMatchObject({
      entityId: context.id,
      action: EReportingContextActions.Updated,
      occurredAt: updated.updatedAt,
      diff: { before: context, after: updated },
    });
    const [repeated, repeatedEvents, repeatedAudit] =
      reportingContextEntity.update(updated, {
        reportingIntervalId: intervalId,
      });
    expect(repeated).toBe(updated);
    expect(repeated.updatedAt).toBe(updated.updatedAt);
    expect(repeatedEvents).toEqual([]);
    expect(repeatedAudit).toBeNull();
  });

  it('preserves identity and produces no effects for empty or identical updates', () => {
    const [context] = reportingContextEntity.make(makePayload());
    for (const changes of [
      {},
      { reportingIntervalId: context.reportingIntervalId },
      { reportingIntervalId: undefined },
    ]) {
      const [unchanged, events, audit] = reportingContextEntity.update(
        context,
        changes
      );
      expect(unchanged).toBe(context);
      expect(unchanged.updatedAt).toBe(context.updatedAt);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    }
  });

  it.each(['invalid', null])(
    'rejects invalid interval input %j before no-op detection',
    (intervalId) => {
      const [context] = reportingContextEntity.make(makePayload());
      expect(() =>
        reportingContextEntity.update(context, {
          reportingIntervalId: intervalId as TEntityId,
        })
      ).toThrow(accountingError.InvalidReportingIntervalId);
      expect(() =>
        reportingContextEntity.update(
          { ...context, reportingIntervalId: intervalId as TEntityId },
          {}
        )
      ).toThrow(accountingError.InvalidReportingIntervalId);
    }
  );

  it('does not copy a legacy reporting standard or current-period reference', () => {
    const payload = {
      ...makePayload(),
      accountingStandardCode: 'INVALID',
      currentReportingPeriodId: generateUUID(),
    };
    const [context] = reportingContextEntity.make(payload);
    const [updated] = reportingContextEntity.update(context, {
      reportingIntervalId: generateUUID(),
    });
    expect(context).not.toHaveProperty('accountingStandardCode');
    expect(context).not.toHaveProperty('currentReportingPeriodId');
    expect(updated).not.toHaveProperty('accountingStandardCode');
    expect(updated).not.toHaveProperty('currentReportingPeriodId');
  });
});
