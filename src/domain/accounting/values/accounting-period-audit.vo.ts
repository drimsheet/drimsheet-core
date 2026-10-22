import {
  EAccountingPeriodActions,
  IAccountingPeriodAudit,
  IMakeAccountingPeriodAuditPayload,
} from '@domain/accounting/types/accounting-period-audit.types';

import accountingAudit from './accounting-audit.vo';

function make(
  payload: IMakeAccountingPeriodAuditPayload
): IAccountingPeriodAudit {
  return accountingAudit.make(payload, EAccountingPeriodActions);
}

const accountingPeriodAudit = Object.freeze({
  make,
});

export default accountingPeriodAudit;
