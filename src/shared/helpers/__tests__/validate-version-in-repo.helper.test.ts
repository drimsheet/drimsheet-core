import validateVersionInRepoHelper from '@shared/helpers/validate-version-in-repo.helper';
import { IVersionedRepoWriteOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';
import historyValue from '@shared/values/history/history.vo';

const entityId = '123e4567-e89b-42d3-a456-426614174000' as TEntityId;
const correlationId = '123e4567-e89b-42d3-a456-426614174001';

function makeHistory(entityVersion: number) {
  return historyValue.make(
    {
      entityId,
      entityVersion,
      action: 'updated',
      diff: {
        before: { id: entityId, version: entityVersion - 1 },
        after: { id: entityId, version: entityVersion },
      },
      occurredAt: new Date(),
    },
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    correlationId
  );
}

describe('validateVersionInRepoHelper', () => {
  it.each([undefined, 0, -1, 1.5])(
    'rejects invalid expected version %s',
    (expectedVersion) => {
      const options = {
        correlationId,
        expectedVersion,
      } as unknown as IVersionedRepoWriteOptions;

      expect(() =>
        validateVersionInRepoHelper({ version: 2 }, options)
      ).toThrow(repoError.VersionRequired);
    }
  );

  it.each([undefined, 0, -1, 1.5])(
    'rejects invalid entity version %s',
    (version) => {
      expect(() =>
        validateVersionInRepoHelper(
          { version } as unknown as { version: number },
          {
            correlationId,
            expectedVersion: 1,
          }
        )
      ).toThrow(repoError.VersionRequired);
    }
  );

  it('rejects an entity version that is not the next version', () => {
    expect(() =>
      validateVersionInRepoHelper(
        { version: 3 },
        { correlationId, expectedVersion: 1 }
      )
    ).toThrow(repoError.VersionMismatch);
  });

  it('rejects a history version that differs from the next entity version', () => {
    expect(() =>
      validateVersionInRepoHelper(
        { version: 2 },
        {
          correlationId,
          expectedVersion: 1,
          history: makeHistory(3),
        }
      )
    ).toThrow(repoError.VersionMismatch);
  });

  it('validates matching entity and history versions', () => {
    expect(() =>
      validateVersionInRepoHelper(
        { version: 2 },
        {
          correlationId,
          expectedVersion: 1,
          history: [makeHistory(2), makeHistory(2)],
        }
      )
    ).not.toThrow();
  });
});
