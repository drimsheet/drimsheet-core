import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  IStatutoryPayableAccountMeta,
  ITradePayableAccountMeta,
} from '@domain/ledger/types/liability-account.types';

function makeStatutoryMeta(
  meta: IStatutoryPayableAccountMeta | null
): IStatutoryPayableAccountMeta | null {
  if (!meta) {
    return null;
  }

  const taxAuthority = stringUtils.sanitizeAndValidate(
    meta.taxAuthority,
    {
      min: 2,
      max: 100,
    },
    ledgerAccountError.InvalidTaxAuthority
  );

  const taxType = stringUtils.sanitizeAndValidate(
    meta.taxType,
    {
      min: 2,
      max: 50,
    },
    ledgerAccountError.InvalidTaxType
  );

  return Object.freeze<IStatutoryPayableAccountMeta>({
    taxAuthority,
    taxType,
  });
}

function makeTradeMeta(
  meta: ITradePayableAccountMeta | null
): ITradePayableAccountMeta | null {
  if (!meta) {
    return null;
  }

  stringUtils.validateUUID(
    meta.counterpartyId,
    ledgerAccountError.InvalidCounterpartyId
  );
  stringUtils.validateUUID(meta.invoiceId, ledgerAccountError.InvalidInvoiceId);

  return Object.freeze<ITradePayableAccountMeta>({
    counterpartyId: meta.counterpartyId,
    invoiceId: meta.invoiceId,
  });
}

const payablesMetaValue = Object.freeze({
  makeStatutoryMeta,
  makeTradeMeta,
});

export default payablesMetaValue;
