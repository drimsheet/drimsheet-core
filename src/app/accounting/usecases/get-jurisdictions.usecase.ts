/**
 * SUMMARY
 * Lists the jurisdictions supported for accounting entity setup. Returns the
 * configured directory without requiring a selected entity.
 *
 * WHEN TO USE
 * Use to populate jurisdiction choices and their currency, fiscal-year limit,
 * and supported accounting standards.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';

import { IJurisdictionDto } from '@app/accounting/dtos/accounting/accounting.dto';

export default function makeGetJurisdictionsUseCase() {
  return async (): Promise<IJurisdictionDto[]> => {
    return Object.values(SYSTEM_JURISDICTIONS).map((jurisdiction) => ({
      code: jurisdiction.code,
      name: jurisdiction.name,
      currencyCode: jurisdiction.currency.code,
      maxFiscalMonths: jurisdiction.maxFiscalMonths,
      accountingStandards: jurisdiction.accountingStandards,
    }));
  };
}
