import z from 'zod';

import userValueObjectError from '@domain/user/errors/user-value-object.error';
import userError from '@domain/user/errors/user.error';
import { EWaitListFeature } from '@domain/user/types/waitlist-member.types';

import { userProfileUpdateDtoSchema } from '@app/user/dtos/user/user.dto.validation';

const invalidEmail = new userValueObjectError.InvalidFormat().errorKey;

export const joinWaitListDtoSchema = z
  .object({
    firstName: userProfileUpdateDtoSchema.shape.firstName.nullable(),
    lastName: userProfileUpdateDtoSchema.shape.lastName.nullable(),
    email: z
      .string(invalidEmail)
      .trim()
      .toLowerCase()
      .email(invalidEmail)
      .max(254, invalidEmail),
    feature: z.enum(
      EWaitListFeature,
      new userError.InvalidWaitListFeature().errorKey
    ),
  })
  .strict();
