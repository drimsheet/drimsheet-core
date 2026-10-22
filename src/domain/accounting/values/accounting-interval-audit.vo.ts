import {
  EAccountingIntervalActions,
  IAccountingIntervalAudit,
  IMakeAccountingIntervalAuditPayload,
} from '@domain/accounting/types/accounting-period-audit.types';

import accountingAudit from './accounting-audit.vo';

function make(
  payload: IMakeAccountingIntervalAuditPayload
): IAccountingIntervalAudit {
  return accountingAudit.make(payload, EAccountingIntervalActions);
}

const accountingIntervalAudit = Object.freeze({
  make,
});

export default accountingIntervalAudit;
