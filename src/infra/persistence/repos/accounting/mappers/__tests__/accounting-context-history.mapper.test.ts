import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';

import accountingContextHistoryMapper from '@infra/persistence/repos/accounting/mappers/accounting-context-history.mapper';

describe('accountingContextHistoryMapper', () => {
  it.each(['created', 'updated'] as const)(
    'preserves interval references in %s snapshots',
    (action) => {
      const actorId = generateUUID();
      const [original, , creationAudit] = accountingContextEntity.make({
        createdBy: actorId,
        accountingEntityId: generateUUID(),
        fiscalYearId: generateUUID(),
        accountingStandardCode: 'IFRS',
        accountingIntervalId: generateUUID(),
        name: 'Context',
        description: null,
      });
      const [updated, , updateAudit] = accountingContextEntity.update(
        original,
        { accountingIntervalId: generateUUID() }
      );
      const context = action === 'created' ? original : updated;
      const audit = action === 'created' ? creationAudit : updateAudit!;
      const history = historyValue.make(audit, actorId, 'context-history');
      const row = accountingContextHistoryMapper.toRepo(context, history);
      expect(row).toEqual({
        accountingContextId: context.id,
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
