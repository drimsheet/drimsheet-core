import z from 'zod';

import { addressDtoValidation } from '@shared/values/contact-details/dto/address.dto.validation';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ECounterpartyRole } from '@domain/counterparty/types/counterparty.types';

import {
  counterpartyCreateReqValidation,
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

import { ICounterpartyAiProposal } from './counterparty-ai-proposal.dto';

const undeterminedValidation = z.literal('__undetermined__');
const invalidRoleDetailsKey = new counterpartyError.InvalidRoleDetails()
  .errorKey;

const proposalAddressValidation = z.strictObject(
  {
    ...addressDtoValidation.shape,
    line2: addressDtoValidation.shape.line2.unwrap().nullable(),
    region: addressDtoValidation.shape.region.unwrap().nullable(),
    postalCode: addressDtoValidation.shape.postalCode.unwrap().nullable(),
  },
  invalidRoleDetailsKey
);

const employerDetailsValidation =
  counterpartyCreateReqValidation.shape.roleDetails
    .unwrap()
    .shape.employer.unwrap();

const proposalRoleDetailsValidation = z.strictObject(
  {
    employer: employerDetailsValidation
      .extend({
        displayName: employerDetailsValidation.shape.displayName.nonoptional(),
        address: proposalAddressValidation,
      })
      .optional(),
    vendor: z
      .strictObject(
        { address: proposalAddressValidation.nullable() },
        invalidRoleDetailsKey
      )
      .optional(),
    contractor: z
      .strictObject(
        { address: proposalAddressValidation },
        invalidRoleDetailsKey
      )
      .optional(),
  },
  invalidRoleDetailsKey
);

export const counterpartyAiProposalDtoValidation = z.strictObject({
  temporaryId: z.string(),
  name: counterpartyNameValidation.or(undeterminedValidation),
  type: counterpartyTypeValidation.or(undeterminedValidation),
  roles: z
    .array(
      z.enum(ECounterpartyRole, new counterpartyError.InvalidRole().errorKey)
    )
    .or(undeterminedValidation),
  roleDetails: proposalRoleDetailsValidation,
}) satisfies z.ZodType<ICounterpartyAiProposal>;
