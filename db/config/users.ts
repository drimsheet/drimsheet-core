import { auditSchema, coreSchema } from '../config/schemas';

export const usersTable = {
  schema: coreSchema,
  name: 'users',
};

export const userAuthTable = {
  schema: coreSchema,
  name: 'user_auth',
};

export const userSessionsTable = {
  schema: coreSchema,
  name: 'user_sessions',
};

export const userPreferencesTable = {
  schema: coreSchema,
  name: 'user_preferences',
};

export const userProfileHistoryTable = {
  schema: auditSchema,
  name: 'user_profile_history',
};

export const waitListMembersTable = {
  schema: coreSchema,
  name: 'waitlist_members',
};
