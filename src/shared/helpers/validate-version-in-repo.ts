import { IVersionedRepoWriteOptions } from '@shared/types/repo.types';
import numberUtils from '@shared/utils/number';
import repoError from '@shared/values/errors/repo.error';
import { IHistory } from '@shared/values/history/types/history.types';

interface IVersionedEntity {
  version: number;
}

type TVersionedHistory = IHistory<object> | IHistory<object>[];

function validateVersion(version: unknown) {
  if (
    typeof version !== 'number' ||
    !numberUtils.isInteger(version) ||
    !numberUtils.isPositiveNumber(version)
  ) {
    throw new repoError.VersionRequired();
  }
}

export default function validateVersionInRepo(
  entity: IVersionedEntity,
  options:
    IVersionedRepoWriteOptions | IVersionedRepoWriteOptions<TVersionedHistory>
) {
  validateVersion(options.expectedVersion);
  validateVersion(entity.version);

  const nextVersion = options.expectedVersion + 1;

  if (entity.version !== nextVersion) {
    throw new repoError.VersionMismatch({
      entityVersion: entity.version,
      expectedVersion: options.expectedVersion,
    });
  }

  if (!('history' in options)) {
    return;
  }

  const histories = Array.isArray(options.history)
    ? options.history
    : [options.history];

  const hasMismatchedHistory = histories.some(
    (history) => history.entityVersion !== nextVersion
  );

  if (hasMismatchedHistory) {
    throw new repoError.VersionMismatch({
      entityVersion: entity.version,
      expectedVersion: options.expectedVersion,
      historyVersions: histories.map((history) => history.entityVersion),
    });
  }
}
