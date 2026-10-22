import {
  EFiscalYearActions,
  IFiscalYearAudit,
  IMakeFiscalYearAuditPayload,
} from '@domain/accounting/types/fiscal-year-audit.types';
import accountingAudit from '@domain/accounting/values/accounting-audit.vo';

function make(payload: IMakeFiscalYearAuditPayload): IFiscalYearAudit {
  return accountingAudit.make(payload, EFiscalYearActions);
}

const fiscalYearAudit = Object.freeze({
  make,
});

export default fiscalYearAudit;
