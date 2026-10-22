import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';

import reportingContextHistoryMapper from '@infra/persistence/repos/accounting/mappers/reporting-context-history.mapper';

describe('reportingContextHistoryMapper', () => {
  it.each(['created', 'updated'] as const)(
    'preserves interval references in %s snapshots',
    (action) => {
      const actorId = generateUUID();
      const [original, , creationAudit] = reportingContextEntity.make({
        createdBy: actorId,
        accountingEntityId: generateUUID(),
        accountingContextId: generateUUID(),
        reportingCurrencyCode: 'USD',
        reportingIntervalId: generateUUID(),
        name: 'Context',
        description: null,
      });
      const [updated, , updateAudit] = reportingContextEntity.update(original, {
        reportingIntervalId: generateUUID(),
      });
      const context = action === 'created' ? original : updated;
      const audit = action === 'created' ? creationAudit : updateAudit!;
      const history = historyValue.make(audit, actorId, 'context-history');
      const row = reportingContextHistoryMapper.toRepo(context, history);
      expect(row).toEqual({
        reportingContextId: context.id,
        accountingEntityId: context.accountingEntityId,
        actorId,
        onBehalfOf: null,
        action,
        diff: {
          before:
            action === 'created'
              ? null
              : (JSON.parse(JSON.stringify(original)) as unknown),
          after: JSON.parse(JSON.stringify(context)) as unknown,
        },
        correlationId: 'context-history',
        occurredAt: history.occurredAt.toISOString(),
      });
      expect(row.diff).toBe(history.diff);
    }
  );
});
