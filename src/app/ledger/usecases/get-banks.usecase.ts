/**
 * SUMMARY
 * Returns the temporary static bank directory for a country code, normalized to
 * uppercase. Results are sorted by bank name; an unsupported country returns an
 * empty array. This does not query a live banking provider.
 *
 * WHEN TO USE
 * Use to populate bank choices during bank-account setup.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import zodValidationRunner from '@shared/utils/zod-validation-runner';

import {
  IBankDirectoryDto,
  IGetBanksQuery,
} from '@app/ledger/dtos/bank-directory/bank-directory.dto';
import { getBanksQueryValidationSchema } from '@app/ledger/dtos/bank-directory/bank-directory.dto.validation';

// TODO: Replace temporary static bank directory with provider-backed integration (e.g. Flutterwave/Paystack)
// https://drimsheet-app.atlassian.net/browse/ENG-120
const TEMPORARY_DUMMY_BANKS: Record<
  string,
  ReadonlyArray<Omit<IBankDirectoryDto, 'countryCode'>>
> = {
  NG: [
    { bankCode: '044', bankName: 'Access Bank' },
    { bankCode: '050', bankName: 'Ecobank Nigeria' },
    { bankCode: '070', bankName: 'Fidelity Bank' },
    { bankCode: '011', bankName: 'First Bank of Nigeria' },
    { bankCode: '214', bankName: 'First City Monument Bank' },
    { bankCode: '058', bankName: 'Guaranty Trust Bank' },
    { bankCode: '030', bankName: 'Heritage Bank' },
    { bankCode: '082', bankName: 'Keystone Bank' },
    { bankCode: '101', bankName: 'Providus Bank' },
    { bankCode: '221', bankName: 'Stanbic IBTC Bank' },
    { bankCode: '068', bankName: 'Standard Chartered Bank' },
    { bankCode: '232', bankName: 'Sterling Bank' },
    { bankCode: '032', bankName: 'Union Bank of Nigeria' },
    { bankCode: '033', bankName: 'United Bank for Africa' },
    { bankCode: '035', bankName: 'Wema Bank' },
    { bankCode: '057', bankName: 'Zenith Bank' },
  ],
};

export default function makeGetBanksUseCase() {
  return async (query: IGetBanksQuery): Promise<IBankDirectoryDto[]> => {
    zodValidationRunner(getBanksQueryValidationSchema, query);

    const countryCode = query.countryCode.toUpperCase();
    const banks = TEMPORARY_DUMMY_BANKS[countryCode] ?? [];

    return banks
      .map((bank) => ({
        countryCode,
        bankCode: bank.bankCode,
        bankName: bank.bankName,
      }))
      .sort((a, b) => a.bankName.localeCompare(b.bankName));
  };
}
