import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyError from '@shared/values/history/history.error';
import historyValue from '@shared/values/history/history.vo';
import intervalValue from '@shared/values/interval/interval.vo';

import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EReportingIntervalActions,
  IReportingIntervalHistory,
  UReportingIntervalActions,
} from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';
import reportingIntervalAudit from '@domain/accounting/values/reporting-interval-audit.vo';

function makeSnapshot(): IReportingInterval {
  const timestamp = new Date('2024-01-01T00:00:00Z');
  const createdBy = generateUUID();
  const interval = intervalValue.make(
    {
      accountingEntityId: generateUUID(),
      unit: 'month',
      count: 2,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      periods: [{ name: 'January' }, { name: 'February' }],
    },
    timestamp
  );
  return {
    ...interval,
    unit: 'month',
    fiscalYearId: generateUUID(),
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    periods: interval.periods.map((period) => ({
      ...period,
      createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  };
}

describe('reportingIntervalAudit', () => {
  it('creates a frozen audit from the new reporting interval shape', () => {
    const after = makeSnapshot();
    const audit = reportingIntervalAudit.make({
      before: null,
      after,
      action: EReportingIntervalActions.Created,
    });

    expect(audit).toEqual({
      entityId: after.id,
      entityVersion: 1,
      action: 'created',
      diff: { before: null, after },
      occurredAt: after.updatedAt,
    });
    expect(Object.isFrozen(reportingIntervalAudit)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);

    const actorId = generateUUID();
    const history: IReportingIntervalHistory = historyValue.make(
      audit,
      actorId,
      'request-123'
    );
    expect(history.entityId).toBe(after.id);
    expect(history.actorId).toBe(actorId);
    expect(history.correlationId).toBe('request-123');
    expect(history.diff.after.createdAt).toBe(after.createdAt.toISOString());
    expect(history.diff.after.fiscalYearId).toBe(after.fiscalYearId);
    expect(history.diff.after.currentPeriodOrdinal).toBe(0);
  });

  it('captures current-period advancement with the original identity', () => {
    const before = makeSnapshot();
    const after: IReportingInterval = {
      ...before,
      currentPeriodOrdinal: 1,
      nextPeriodStartDate: null,
      updatedAt: new Date('2024-02-01'),
    };
    const audit = reportingIntervalAudit.make({
      before,
      after,
      action: EReportingIntervalActions.Updated,
    });

    expect(audit.entityId).toBe(before.id);
    expect(audit.action).toBe('updated');
    expect(audit.diff).toEqual({ before, after });
    expect(audit.occurredAt).toBe(after.updatedAt);
  });

  it('rejects invalid identity and occurrence dates', () => {
    const after = makeSnapshot();
    expect(() =>
      reportingIntervalAudit.make({
        before: null,
        after: { ...after, id: 'bad' as TEntityId },
        action: EReportingIntervalActions.Created,
      })
    ).toThrow(accountingError.InvalidId);
    expect(() =>
      reportingIntervalAudit.make({
        before: null,
        after: { ...after, updatedAt: new Date(NaN) },
        action: EReportingIntervalActions.Created,
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('rejects actions outside its own lifecycle', () => {
    expect(() =>
      reportingIntervalAudit.make({
        before: null,
        after: makeSnapshot(),
        action: 'closed' as UReportingIntervalActions,
      })
    ).toThrow(accountingError.InvalidAction);
  });

  it('does not manufacture an audit for identical snapshots', () => {
    const snapshot = makeSnapshot();
    expect(() =>
      reportingIntervalAudit.make({
        before: snapshot,
        after: snapshot,
        action: EReportingIntervalActions.Updated,
      })
    ).toThrow(historyError.InvalidDiff);
  });
});
