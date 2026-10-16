import { eq } from 'drizzle-orm';

import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';

import { userPreferencesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import userPreferencesMapper from '@infra/persistence/repos/user/mappers/user-preferences.mapper';

const userPreferencesRepo: IUserPreferencesRepo = {
  async clearAccountingEntity(accountingEntityId, options) {
    await getDbQuery(options)
      .update(userPreferencesInCore)
      .set({
        lastActiveAccountingEntityId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        eq(
          userPreferencesInCore.lastActiveAccountingEntityId,
          accountingEntityId
        )
      );
  },

  async update(preferences, options) {
    const query = getDbQuery(options);
    const preferenceValues = userPreferencesMapper.toRepo(preferences);

    await query
      .insert(userPreferencesInCore)
      .values(preferenceValues)
      .onConflictDoUpdate({
        target: userPreferencesInCore.id,
        set: {
          appPreferences: preferenceValues.appPreferences,
          lastActiveAccountingEntityId:
            preferenceValues.lastActiveAccountingEntityId,
          updatedAt: preferenceValues.updatedAt,
        },
      });
  },

  async findById(id, options) {
    const query = getDbQuery(options);

    const [result] = await query
      .select()
      .from(userPreferencesInCore)
      .where(eq(userPreferencesInCore.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    return userPreferencesMapper.toDomain(result);
  },
};

export default userPreferencesRepo;
