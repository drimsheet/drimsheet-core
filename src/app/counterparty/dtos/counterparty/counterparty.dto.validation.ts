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
const invalidRoleDetailsKey = new counterpartyError.InvalidRoleDetails()
  .errorKey;

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
  invalidRoleDetailsKey
);

const counterpartyCreateRoleDetailsValidation = z
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
          invalidRoleDetailsKey
        )
        .optional(),
      vendor: z
        .strictObject(
          {
            address: counterpartyAddressValidation.nullish(),
          },
          invalidRoleDetailsKey
        )
        .optional(),
      contractor: z
        .strictObject(
          {
            address: counterpartyAddressValidation,
          },
          invalidRoleDetailsKey
        )
        .optional(),
    },
    invalidRoleDetailsKey
  )
  .superRefine((roleDetails, ctx) => {
    for (const role of Object.keys(roleDetails)) {
      if (roleDetails[role as UCounterpartyRole] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [role],
          message: invalidRoleDetailsKey,
        });
      }
    }
  });

export const counterpartyCreateReqValidation = z.strictObject(
  {
    name: counterpartyNameValidation,
    status: counterpartyStatusValidation,
    type: counterpartyTypeValidation,
    roleDetails: counterpartyCreateRoleDetailsValidation.optional(),
  },
  invalidRoleDetailsKey
);

export const counterpartyUpdateReqValidation = z
  .strictObject(
    {
      name: counterpartyNameValidation.optional(),
      type: counterpartyTypeValidation.optional(),
      status: z.literal('active', invalidStatusKey).optional(),
      roleDetails: counterpartyCreateRoleDetailsValidation.optional(),
    },
    invalidRoleDetailsKey
  )
  .refine(
    (payload) =>
      [payload.name, payload.type, payload.status, payload.roleDetails].some(
        (value) => value !== undefined
      ),
    new counterpartyError.InvalidUpdate().errorKey
  );

export const getCounterpartiesQueryValidationSchema = z.object({
  ...omit(paginationDtoValidation.shape, ['orderBy']),
  roles: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') {
        return undefined;
      }
      return Array.isArray(val) ? val : [val];
    }, z.array(counterpartyRoleValidation).optional())
    .optional(),
  type: counterpartyTypeValidation.optional(),
  status: counterpartyStatusValidation.optional(),
  orderBy: counterpartyOrderByValidationSchema.optional(),
});
