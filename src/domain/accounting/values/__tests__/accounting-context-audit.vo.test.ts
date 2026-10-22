import { TEntityId } from '@shared/types/uuid';
import historyError from '@shared/values/history/history.error';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EAccountingContextActions,
  UAccountingContextActions,
} from '@domain/accounting/types/accounting-context-audit.types';
import accountingContextAudit from '@domain/accounting/values/accounting-context-audit.vo';

describe('accountingContextAudit', () => {
  const makeAccountingContext = () =>
    accountingContextEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Primary Ledger',
      description: 'The primary US GAAP ledger',
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      accountingStandardCode: 'IFRS',
      fiscalYearId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
      accountingIntervalId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    })[0];

  describe('make', () => {
    it('creates an audit record for accounting context creation', () => {
      const accountingContext = makeAccountingContext();

      const audit = accountingContextAudit.make({
        before: null,
        after: accountingContext,
        action: EAccountingContextActions.Created,
      });

      expect(audit.entityId).toBe(accountingContext.id);
      expect(audit.action).toBe(EAccountingContextActions.Created);
      expect(audit.occurredAt).toBe(accountingContext.updatedAt);
      expect(audit.diff.before).toBeNull();
      expect(audit.diff.after).toEqual(accountingContext);
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('throws accountingError.InvalidId if the context ID is invalid', () => {
      const accountingContext = makeAccountingContext();

      expect(() =>
        accountingContextAudit.make({
          before: null,
          after: {
            ...accountingContext,
            id: 'invalid-id' as TEntityId,
          },
          action: EAccountingContextActions.Created,
        })
      ).toThrow(accountingError.InvalidId);
    });

    it('throws accountingError.InvalidAction if the action is invalid', () => {
      const accountingContext = makeAccountingContext();

      expect(() =>
        accountingContextAudit.make({
          before: null,
          after: accountingContext,
          action: 'invalid-action' as UAccountingContextActions,
        })
      ).toThrow(accountingError.InvalidAction);
    });

    it('throws accountingError.InvalidDate if updatedAt is invalid', () => {
      const accountingContext = makeAccountingContext();

      expect(() =>
        accountingContextAudit.make({
          before: null,
          after: {
            ...accountingContext,
            updatedAt: new Date('invalid-date'),
          },
          action: EAccountingContextActions.Created,
        })
      ).toThrow(accountingError.InvalidDate);
    });

    it('throws historyError.InvalidDiff if there are no changes', () => {
      const accountingContext = makeAccountingContext();

      expect(() =>
        accountingContextAudit.make({
          before: accountingContext,
          after: accountingContext,
          action: EAccountingContextActions.Created,
        })
      ).toThrow(historyError.InvalidDiff);
    });
  });
});
