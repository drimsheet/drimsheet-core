import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyError from '@shared/values/history/history.error';
import historyValue from '@shared/values/history/history.vo';
import intervalValue from '@shared/values/interval/interval.vo';

import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EAccountingIntervalActions,
  IAccountingIntervalHistory,
  UAccountingIntervalActions,
} from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';
import accountingIntervalAudit from '@domain/accounting/values/accounting-interval-audit.vo';

function makeSnapshot(): IAccountingInterval {
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
      status: 'open' as const,
      closedAt: null,
      createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  };
}

describe('accountingIntervalAudit', () => {
  it('creates a frozen audit from the new accounting interval shape', () => {
    const after = makeSnapshot();
    const audit = accountingIntervalAudit.make({
      before: null,
      after,
      action: EAccountingIntervalActions.Created,
    });

    expect(audit).toEqual({
      entityId: after.id,
      entityVersion: 1,
      action: 'created',
      diff: { before: null, after },
      occurredAt: after.updatedAt,
    });
    expect(Object.isFrozen(accountingIntervalAudit)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);

    const actorId = generateUUID();
    const history: IAccountingIntervalHistory = historyValue.make(
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
    const after: IAccountingInterval = {
      ...before,
      currentPeriodOrdinal: 1,
      nextPeriodStartDate: null,
      updatedAt: new Date('2024-02-01'),
    };
    const audit = accountingIntervalAudit.make({
      before,
      after,
      action: EAccountingIntervalActions.Updated,
    });

    expect(audit.entityId).toBe(before.id);
    expect(audit.action).toBe('updated');
    expect(audit.diff).toEqual({ before, after });
    expect(audit.occurredAt).toBe(after.updatedAt);
  });

  it('rejects invalid identity and occurrence dates', () => {
    const after = makeSnapshot();
    expect(() =>
      accountingIntervalAudit.make({
        before: null,
        after: { ...after, id: 'bad' as TEntityId },
        action: EAccountingIntervalActions.Created,
      })
    ).toThrow(accountingError.InvalidId);
    expect(() =>
      accountingIntervalAudit.make({
        before: null,
        after: { ...after, updatedAt: new Date(NaN) },
        action: EAccountingIntervalActions.Created,
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('rejects actions outside its own lifecycle', () => {
    expect(() =>
      accountingIntervalAudit.make({
        before: null,
        after: makeSnapshot(),
        action: 'closed' as UAccountingIntervalActions,
      })
    ).toThrow(accountingError.InvalidAction);
  });

  it('does not manufacture an audit for identical snapshots', () => {
    const snapshot = makeSnapshot();
    expect(() =>
      accountingIntervalAudit.make({
        before: snapshot,
        after: snapshot,
        action: EAccountingIntervalActions.Updated,
      })
    ).toThrow(historyError.InvalidDiff);
  });
});
