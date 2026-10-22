import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyError from '@shared/values/history/history.error';
import historyValue from '@shared/values/history/history.vo';
import intervalValue from '@shared/values/interval/interval.vo';

import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EAccountingPeriodActions,
  IAccountingPeriodHistory,
  UAccountingPeriodActions,
} from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';
import accountingPeriodAudit from '@domain/accounting/values/accounting-period-audit.vo';

function makeSnapshot(): IAccountingPeriod {
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
    status: 'open' as const,
    closedAt: null,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('accountingPeriodAudit', () => {
  it('creates a frozen audit from the new accounting period shape', () => {
    const after = makeSnapshot();
    const audit = accountingPeriodAudit.make({
      before: null,
      after,
      action: EAccountingPeriodActions.Created,
    });

    expect(audit).toEqual({
      entityId: after.id,
      entityVersion: 1,
      action: 'created',
      diff: { before: null, after },
      occurredAt: after.updatedAt,
    });
    expect(Object.isFrozen(accountingPeriodAudit)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);

    const actorId = generateUUID();
    const history: IAccountingPeriodHistory = historyValue.make(
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
    const after: IAccountingPeriod = {
      ...before,
      name: 'January revised',
      updatedAt: new Date('2024-02-01'),
    };
    const audit = accountingPeriodAudit.make({
      before,
      after,
      action: EAccountingPeriodActions.Updated,
    });

    expect(audit.entityId).toBe(before.id);
    expect(audit.action).toBe('updated');
    expect(audit.diff).toEqual({ before, after });
    expect(audit.occurredAt).toBe(after.updatedAt);
  });

  it('rejects invalid identity and occurrence dates', () => {
    const after = makeSnapshot();
    expect(() =>
      accountingPeriodAudit.make({
        before: null,
        after: { ...after, id: 'bad' as TEntityId },
        action: EAccountingPeriodActions.Created,
      })
    ).toThrow(accountingError.InvalidId);
    expect(() =>
      accountingPeriodAudit.make({
        before: null,
        after: { ...after, updatedAt: new Date(NaN) },
        action: EAccountingPeriodActions.Created,
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('rejects actions outside its own lifecycle', () => {
    expect(() =>
      accountingPeriodAudit.make({
        before: null,
        after: makeSnapshot(),
        action: 'invalid' as UAccountingPeriodActions,
      })
    ).toThrow(accountingError.InvalidAction);
  });

  it('does not manufacture an audit for identical snapshots', () => {
    const snapshot = makeSnapshot();
    expect(() =>
      accountingPeriodAudit.make({
        before: snapshot,
        after: snapshot,
        action: EAccountingPeriodActions.Updated,
      })
    ).toThrow(historyError.InvalidDiff);
  });

  it('records closing and reopening without introducing other statuses', () => {
    const open = makeSnapshot();
    const closed: IAccountingPeriod = {
      ...open,
      status: 'closed',
      closedAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    };
    const closingAudit = accountingPeriodAudit.make({
      before: open,
      after: closed,
      action: EAccountingPeriodActions.Closed,
    });
    expect(closingAudit.diff.after.status).toBe('closed');
    expect(closingAudit.action).toBe('closed');

    const reopened: IAccountingPeriod = {
      ...closed,
      status: 'open',
      closedAt: null,
      updatedAt: new Date('2024-02-02'),
    };
    const reopeningAudit = accountingPeriodAudit.make({
      before: closed,
      after: reopened,
      action: EAccountingPeriodActions.Reopened,
    });
    expect(reopeningAudit.diff.after.status).toBe('open');
    expect(reopeningAudit.diff.after.closedAt).toBeNull();
    expect(reopeningAudit.action).toBe('reopened');
  });
});
