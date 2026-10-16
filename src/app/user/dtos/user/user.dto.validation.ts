import z from 'zod';

import userError from '@domain/user/errors/user.error';

import userPreferencesAppError from '@app/user/errors/user-preferences.error';
import {
  EAppThemePreference,
  EAppUsageModePreference,
  UAppThemePreference,
  UAppUsageModePreference,
} from '@app/user/types/user-preferences.types';

const invalidFirstName = new userError.InvalidFirstName().errorKey;
const invalidLastName = new userError.InvalidLastName().errorKey;

export const userProfileUpdateDtoSchema = z
  .object({
    firstName: z
      .string(invalidFirstName)
      .trim()
      .min(1, invalidFirstName)
      .max(100, invalidFirstName)
      .optional(),
    lastName: z
      .string(invalidLastName)
      .trim()
      .min(1, invalidLastName)
      .max(100, invalidLastName)
      .optional(),
  })
  .strict();

export const userAppThemePreferenceValidation = z.enum(
  Object.values(EAppThemePreference) as [
    UAppThemePreference,
    ...UAppThemePreference[],
  ],
  new userPreferencesAppError.InvalidAppTheme().errorKey
);

export const userAppUsageModePreferenceValidation = z.enum(
  Object.values(EAppUsageModePreference) as [
    UAppUsageModePreference,
    ...UAppUsageModePreference[],
  ],
  new userPreferencesAppError.InvalidAppUsageMode().errorKey
);

export const userAppPreferencesValidation = z
  .object({
    theme: userAppThemePreferenceValidation.optional(),
    appUsageMode: userAppUsageModePreferenceValidation,
  })
  .strict();

export const userPreferencesUpdateDtoSchema = z
  .object({
    theme: userAppPreferencesValidation.shape.theme,
    appUsageMode: userAppPreferencesValidation.shape.appUsageMode.optional(),
  })
  .strict()
  .refine((preferences) => Object.keys(preferences).length > 0, {
    message: new userPreferencesAppError.InvalidAppPreferences().errorKey,
  });
