import {
  EReportingIntervalActions,
  IMakeReportingIntervalAuditPayload,
  IReportingIntervalAudit,
} from '@domain/accounting/types/reporting-period-audit.types';

import accountingAudit from './accounting-audit.vo';

function make(
  payload: IMakeReportingIntervalAuditPayload
): IReportingIntervalAudit {
  return accountingAudit.make(payload, EReportingIntervalActions);
}

const reportingIntervalAudit = Object.freeze({
  make,
});

export default reportingIntervalAudit;
