import stringUtils from '@shared/utils/string';

import accountingError from '@domain/accounting/errors/accounting.error';

export default function getAccountingContextDescriptionHelper(
  description: string | null
) {
  return description != null
    ? stringUtils.sanitizeAndValidate(
        description,
        {
          min: 1,
          max: 255,
        },
        accountingError.InvalidDescription
      )
    : null;
}
