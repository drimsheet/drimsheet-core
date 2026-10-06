import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';

describe('journalEntryMutationPolicy', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const otherUserId = '123e4567-e89b-12d3-a456-426614174006' as TEntityId;
  const entry = {
    id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
    accountingEntityId,
    createdBy: userId,
    version: 2,
  } as IJournalEntry;

  const validate = (candidate: IJournalEntry | null = entry) =>
    journalEntryMutationPolicy.validate({
      id: entry.id,
      entry: candidate,
      accountingEntityId,
    });

  it('returns an entry authorized for mutation', () => {
    expect(validate()).toBe(entry);
  });

  it.each([
    ['missing', null],
    [
      'outside the active accounting entity',
      {
        ...entry,
        accountingEntityId: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
        createdBy: otherUserId,
        version: 3,
      },
    ],
  ])('hides an entry that is %s', (_, candidate) => {
    expect(() => validate(candidate)).toThrow(appError.ResourceNotFound);
  });

  it.each([
    userId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])(
    'allows any creator UUID after accounting ownership has been checked',
    (createdBy) => {
      expect(validate({ ...entry, createdBy }).createdBy).toBe(createdBy);
    }
  );
});
