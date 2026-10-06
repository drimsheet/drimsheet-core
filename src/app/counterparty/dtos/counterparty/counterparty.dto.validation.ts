import { omit } from 'lodash';
import z from 'zod';

import { addressDtoValidation } from '@shared/values/contact-details/dto/address.dto.validation';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import paginationError from '@shared/values/pagination/pagination.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartySortBy,
  UCounterpartySortBy,
} from '@domain/counterparty/repos/counterparty.repo';
import {
  ECounterpartyRole,
  ECounterpartyStatus,
  ECounterpartyType,
  UCounterpartyRole,
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

const invalidNameKey = new counterpartyError.InvalidName().errorKey;
const invalidTypeKey = new counterpartyError.InvalidType().errorKey;
const invalidStatusKey = new counterpartyError.InvalidStatus().errorKey;
const invalidRoleKey = new counterpartyError.InvalidRole().errorKey;
const invalidOrderByKey = new paginationError.InvalidOrderBy().errorKey;
const invalidMetaKey = new counterpartyError.InvalidMeta().errorKey;

const counterpartyStatusValidation = z.enum(
  Object.values(ECounterpartyStatus) as [
    UCounterpartyStatus,
    ...UCounterpartyStatus[],
  ],
  invalidStatusKey
);

export const counterpartyTypeValidation = z.enum(
  Object.values(ECounterpartyType) as [
    UCounterpartyType,
    ...UCounterpartyType[],
  ],
  invalidTypeKey
);

const counterpartyRoleValidation = z.enum(
  Object.values(ECounterpartyRole) as [
    UCounterpartyRole,
    ...UCounterpartyRole[],
  ],
  invalidRoleKey
);

const counterpartyOrderByValidationSchema = z.enum(
  Object.values(ECounterpartySortBy) as [
    UCounterpartySortBy,
    ...UCounterpartySortBy[],
  ],
  invalidOrderByKey
);

export const counterpartyNameValidation = z
  .string(invalidNameKey)
  .trim()
  .min(1, invalidNameKey)
  .max(255, invalidNameKey);

const counterpartyAddressValidation = z.strictObject(
  addressDtoValidation.shape,
  invalidMetaKey
);

const counterpartyCreateMetaValidation = z
  .strictObject(
    {
      employer: z
        .strictObject(
          {
            displayName: z
              .string(invalidNameKey)
              .trim()
              .max(255, invalidNameKey)
              .nullish(),
            address: counterpartyAddressValidation,
          },
          invalidMetaKey
        )
        .optional(),
      vendor: z
        .strictObject(
          {
            address: counterpartyAddressValidation.nullish(),
          },
          invalidMetaKey
        )
        .optional(),
      contractor: z
        .strictObject(
          {
            address: counterpartyAddressValidation,
          },
          invalidMetaKey
        )
        .optional(),
    },
    invalidMetaKey
  )
  .superRefine((meta, ctx) => {
    for (const role of Object.keys(meta)) {
      if (meta[role as UCounterpartyRole] === undefined) {
        ctx.addIssue({ code: 'custom', path: [role], message: invalidMetaKey });
      }
    }
  });

export const counterpartyCreateReqValidation = z.strictObject(
  {
    name: counterpartyNameValidation,
    status: counterpartyStatusValidation,
    type: counterpartyTypeValidation,
    meta: counterpartyCreateMetaValidation.optional(),
  },
  invalidMetaKey
);

export const counterpartyUpdateReqValidation = z
  .strictObject(
    {
      name: counterpartyNameValidation.optional(),
      type: counterpartyTypeValidation.optional(),
      status: z.literal('active', invalidStatusKey).optional(),
      meta: counterpartyCreateMetaValidation.optional(),
    },
    invalidMetaKey
  )
  .refine(
    (payload) =>
      [payload.name, payload.type, payload.status, payload.meta].some(
        (value) => value !== undefined
      ),
    new counterpartyError.InvalidUpdate().errorKey
  );

export const getCounterpartiesQueryValidationSchema = z.object({
  ...omit(paginationDtoValidation.shape, ['orderBy']),
  roles: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return Array.isArray(val) ? val : [val];
    }, z.array(counterpartyRoleValidation).optional())
    .optional(),
  type: counterpartyTypeValidation.optional(),
  status: counterpartyStatusValidation.optional(),
  orderBy: counterpartyOrderByValidationSchema.optional(),
});
