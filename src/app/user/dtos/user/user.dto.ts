import { TEntityId } from '@shared/types/uuid';

import {
  UAppThemePreference,
  UAppUsageModePreference,
} from '@app/user/types/user-preferences.types';

export interface IUserPreferencesUpdateDto {
  theme?: UAppThemePreference;
  appUsageMode?: UAppUsageModePreference;
}

export interface IUserProfileDto {
  id: TEntityId;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfileUpdateDto {
  firstName?: string;
  lastName?: string;
}
