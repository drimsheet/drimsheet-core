import {
  EReportingPeriodActions,
  IMakeReportingPeriodAuditPayload,
  IReportingPeriodAudit,
} from '@domain/accounting/types/reporting-period-audit.types';

import accountingAudit from './accounting-audit.vo';

function make(
  payload: IMakeReportingPeriodAuditPayload
): IReportingPeriodAudit {
  return accountingAudit.make(payload, EReportingPeriodActions);
}

const reportingPeriodAudit = Object.freeze({
  make,
});

export default reportingPeriodAudit;
