import { TEntityId } from '@shared/types/uuid';

import { IFiscalYearHistory } from '@domain/accounting/types/fiscal-year-audit.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import fiscalYearHistoryMapper from '@infra/persistence/repos/accounting/mappers/fiscal-year-history.mapper';

describe('fiscalYearHistoryMapper', () => {
  it('maps fiscal year history to the repository model', () => {
    const fiscalYearId = 'fiscal-year-uuid' as TEntityId;
    const accountingEntityId = 'accounting-entity-uuid' as TEntityId;
    const userId = 'user-uuid' as TEntityId;
    const occurredAt = new Date('2026-07-25T12:00:00.000Z');

    const fiscalYear: IFiscalYear = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId,
    } as IFiscalYear;

    const history: IFiscalYearHistory = {
      entityId: fiscalYearId,
      entityVersion: 1,
      action: 'created',
      diff: {
        before: null,
        after: fiscalYear,
      },
      occurredAt,
      actorId: userId,
      onBehalfOf: null,
      correlationId: 'correlation-id-ghi',
    };

    expect(fiscalYearHistoryMapper.toRepo(fiscalYear, history)).toEqual({
      fiscalYearId,
      accountingEntityId,
      actorId: userId,
      onBehalfOf: null,
      action: 'created',
      diff: history.diff,
      correlationId: 'correlation-id-ghi',
      occurredAt: toRepoDate(occurredAt),
    });
  });
});
