import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IBankDetails } from '@domain/ledger/types/asset-account.types';

import { bankDetailsInCore } from '@infra/config/drizzle/schema';

interface IBankAccountModel extends InferSelectModel<
  typeof bankDetailsInCore
> {}

const bankAccountMapper = {
  toRepo(
    ledgerAccountId: TEntityId,
    accountingEntityId: TEntityId,
    value: IBankDetails,
    createdBy: TEntityId
  ): IBankAccountModel {
    return {
      createdBy,
      bankName: value.bankName,
      accountNumber: value.accountNumber,
      accountName: value.accountName,
      countryCode: value.countryCode,
      accountingEntityId,
      ledgerAccountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  toUpdateRepo(value: IBankDetails) {
    return {
      bankName: value.bankName,
      accountNumber: value.accountNumber,
      accountName: value.accountName,
      countryCode: value.countryCode,
      updatedAt: new Date().toISOString(),
    };
  },

  toDomain(record: IBankAccountModel): IBankDetails {
    return {
      countryCode: record.countryCode,
      bankName: record.bankName,
      accountName: record.accountName,
      accountNumber: record.accountNumber,
    };
  },
};

export default bankAccountMapper;
