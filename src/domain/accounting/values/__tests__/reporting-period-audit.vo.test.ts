import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyError from '@shared/values/history/history.error';
import historyValue from '@shared/values/history/history.vo';
import intervalValue from '@shared/values/interval/interval.vo';

import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EReportingPeriodActions,
  IReportingPeriodHistory,
  UReportingPeriodActions,
} from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';
import reportingPeriodAudit from '@domain/accounting/values/reporting-period-audit.vo';

function makeSnapshot(): IReportingPeriod {
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
    ...interval.periods[0],
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('reportingPeriodAudit', () => {
  it('creates a frozen audit from the new reporting period shape', () => {
    const after = makeSnapshot();
    const audit = reportingPeriodAudit.make({
      before: null,
      after,
      action: EReportingPeriodActions.Created,
    });

    expect(audit).toEqual({
      entityId: after.id,
      entityVersion: 1,
      action: 'created',
      diff: { before: null, after },
      occurredAt: after.updatedAt,
    });
    expect(Object.isFrozen(reportingPeriodAudit)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);

    const actorId = generateUUID();
    const history: IReportingPeriodHistory = historyValue.make(
      audit,
      actorId,
      'request-123'
    );
    expect(history.entityId).toBe(after.id);
    expect(history.actorId).toBe(actorId);
    expect(history.correlationId).toBe('request-123');
    expect(history.diff.after.createdAt).toBe(after.createdAt.toISOString());
    expect(history.diff.after.intervalId).toBe(after.intervalId);
    expect(history.diff.after.ordinal).toBe(0);
  });

  it('captures period edits with the original identity', () => {
    const before = makeSnapshot();
    const after: IReportingPeriod = {
      ...before,
      name: 'January revised',
      updatedAt: new Date('2024-02-01'),
    };
    const audit = reportingPeriodAudit.make({
      before,
      after,
      action: EReportingPeriodActions.Updated,
    });

    expect(audit.entityId).toBe(before.id);
    expect(audit.action).toBe('updated');
    expect(audit.diff).toEqual({ before, after });
    expect(audit.occurredAt).toBe(after.updatedAt);
  });

  it('rejects invalid identity and occurrence dates', () => {
    const after = makeSnapshot();
    expect(() =>
      reportingPeriodAudit.make({
        before: null,
        after: { ...after, id: 'bad' as TEntityId },
        action: EReportingPeriodActions.Created,
      })
    ).toThrow(accountingError.InvalidId);
    expect(() =>
      reportingPeriodAudit.make({
        before: null,
        after: { ...after, updatedAt: new Date(NaN) },
        action: EReportingPeriodActions.Created,
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('rejects actions outside its own lifecycle', () => {
    expect(() =>
      reportingPeriodAudit.make({
        before: null,
        after: makeSnapshot(),
        action: 'closed' as UReportingPeriodActions,
      })
    ).toThrow(accountingError.InvalidAction);
  });

  it('does not manufacture an audit for identical snapshots', () => {
    const snapshot = makeSnapshot();
    expect(() =>
      reportingPeriodAudit.make({
        before: snapshot,
        after: snapshot,
        action: EReportingPeriodActions.Updated,
      })
    ).toThrow(historyError.InvalidDiff);
  });
});
