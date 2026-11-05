import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

export default function getLedgerAccountMaterializedPathHelper<
  T extends string,
>(parentMaterializedPath: T, code: string): T {
  const isValidParent = stringUtils.isStringWithinRange(
    parentMaterializedPath,
    { min: 6, max: 62, sanitize: false }
  );

  if (!isValidParent) {
    throw new ledgerAccountError.InvalidParentMaterializedPath({
      parentMaterializedPath,
    });
  }

  return `${parentMaterializedPath}.${code}` as T;
}
