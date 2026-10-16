import {
  userAppPreferencesValidation,
  userAppThemePreferenceValidation,
  userAppUsageModePreferenceValidation,
  userPreferencesUpdateDtoSchema,
  userProfileUpdateDtoSchema,
} from '@app/user/dtos/user/user.dto.validation';
import {
  EAppThemePreference,
  EAppUsageModePreference,
} from '@app/user/types/user-preferences.types';

describe('User DTO Validation', () => {
  it.each([
    {},
    { firstName: 'First' },
    { lastName: 'Last' },
    { firstName: ' First ', lastName: ' Last ' },
    { firstName: 'x'.repeat(100), lastName: 'x'.repeat(100) },
  ])('validates name-only profile updates', (profile) => {
    expect(userProfileUpdateDtoSchema.safeParse(profile).success).toBe(true);
  });

  it.each([
    { firstName: '' },
    { firstName: ' ' },
    { lastName: '' },
    { lastName: ' ' },
    { firstName: null },
    { lastName: null },
    { firstName: 123 },
    { lastName: false },
    { firstName: 'x'.repeat(101) },
    { lastName: 'x'.repeat(101) },
    { email: 'other@example.com' },
    { firstName: 'First', emailVerified: true },
    { userId: 'other' },
  ])('rejects invalid or unsupported profile fields', (profile) => {
    expect(userProfileUpdateDtoSchema.safeParse(profile).success).toBe(false);
  });

  it.each(Object.values(EAppThemePreference))(
    'validates the %s app theme',
    (theme) => {
      expect(userAppThemePreferenceValidation.safeParse(theme).success).toBe(
        true
      );
    }
  );

  it('rejects an unsupported app theme', () => {
    expect(userAppThemePreferenceValidation.safeParse('sepia').success).toBe(
      false
    );
  });

  it('validates supported app usage modes', () => {
    expect(
      userAppUsageModePreferenceValidation.safeParse(
        EAppUsageModePreference.NonPowerUser
      ).success
    ).toBe(true);
    expect(
      userAppUsageModePreferenceValidation.safeParse('power_user').success
    ).toBe(true);
  });

  it.each([
    { theme: EAppThemePreference.Dark },
    { appUsageMode: EAppUsageModePreference.NonPowerUser },
  ])('validates a non-empty preference update', (preferences) => {
    expect(userPreferencesUpdateDtoSchema.safeParse(preferences).success).toBe(
      true
    );
  });

  it('validates complete app preferences for composition', () => {
    expect(
      userAppPreferencesValidation.safeParse({
        theme: EAppThemePreference.System,
        appUsageMode: EAppUsageModePreference.PowerUser,
      }).success
    ).toBe(true);
  });

  it.each([
    {},
    { theme: null },
    { appUsageMode: null },
    { unknown: true },
    { theme: EAppThemePreference.Dark, unknown: true },
  ])('rejects invalid preference updates', (preferences) => {
    expect(userPreferencesUpdateDtoSchema.safeParse(preferences).success).toBe(
      false
    );
  });
});
