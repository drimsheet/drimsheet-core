import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';

import waitListMemberEntity from '@domain/user/entities/waitlist-member.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockWaitListMemberRepo } from '@app/user/contracts/__mocks__/user.repos.mock';
import makeJoinWaitListUsecase from '@app/user/usecases/join-waitlist.usecase';

const payload = { email: ' Member@Example.com ', feature: 'mvp' as const };
const usecase = makeJoinWaitListUsecase({
  appContext: mockAppContext,
  waitListMemberRepo: mockWaitListMemberRepo,
  eventBus: mockEventBus,
});

describe('makeJoinWaitListUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'waitlist',
      idempotencyKey: 'submission',
    });
    mockEventBus.publish.mockResolvedValue(undefined);
    mockWaitListMemberRepo.findByEmailAndFeature.mockResolvedValue(null);
    mockWaitListMemberRepo.create.mockResolvedValue(undefined);
  });
  it('checks normalized membership before persisting', async () => {
    await expect(usecase(payload)).resolves.toBeUndefined();
    expect(mockWaitListMemberRepo.findByEmailAndFeature).toHaveBeenCalledWith(
      'member@example.com',
      'mvp',
      { correlationId: 'waitlist' }
    );
    expect(mockWaitListMemberRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'member@example.com',
        feature: 'mvp',
        firstName: null,
        lastName: null,
      }),
      { correlationId: 'waitlist' }
    );
  });
  it('creates the entity only after the membership lookup completes', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-10-28T08:00:00.000Z'));
      let completeLookup: () => void = () => {
        throw new Error('lookup has not started');
      };
      mockWaitListMemberRepo.findByEmailAndFeature.mockImplementation(
        () =>
          new Promise((resolve) => {
            completeLookup = () => resolve(null);
          })
      );

      const submission = usecase(payload);
      expect(mockWaitListMemberRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();

      const creationTime = new Date('2026-10-28T08:01:00.000Z');
      jest.setSystemTime(creationTime);
      completeLookup();
      await submission;

      const [member] = mockWaitListMemberRepo.create.mock.calls[0];
      expect(member.createdAt).toEqual(creationTime);
    } finally {
      jest.useRealTimers();
    }
  });
  it('publishes the enriched creation event after persistence finishes', async () => {
    let completeInsertion: () => void = () => {
      throw new Error('insertion has not started');
    };
    mockWaitListMemberRepo.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeInsertion = resolve;
        })
    );
    const submission = usecase(payload);
    await Promise.resolve();
    expect(mockWaitListMemberRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();

    completeInsertion();
    await submission;

    const [member] = mockWaitListMemberRepo.create.mock.calls[0];
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:waitlist-member:created',
        data: member,
        correlationId: 'waitlist',
        idempotencyKey: 'submission',
        enrichedAt: expect.any(Date),
      }),
    ]);
  });
  it('publishes only the successful creation when simultaneous inserts conflict', async () => {
    const conflict = Object.assign(new Error('unique constraint violation'), {
      code: '23505',
    });
    mockWaitListMemberRepo.create
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(conflict);

    const submissions = await Promise.allSettled([
      usecase(payload),
      usecase(payload),
    ]);

    expect(submissions).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: conflict },
    ]);
    expect(mockWaitListMemberRepo.create).toHaveBeenCalledTimes(2);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
  it('preserves an existing membership without writing', async () => {
    const [existing] = waitListMemberEntity.make({
      ...payload,
      firstName: 'Original',
      lastName: null,
    });
    mockWaitListMemberRepo.findByEmailAndFeature.mockResolvedValue(existing);
    await usecase({ ...payload, firstName: 'Changed' });
    expect(mockWaitListMemberRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it.each([
    { email: 'invalid' },
    { feature: 'other' },
    { firstName: '' },
    { lastName: 'x'.repeat(101) },
  ])('rejects invalid input %j before lookup', async (invalid) => {
    await expect(
      usecase({ ...payload, ...invalid } as Parameters<typeof usecase>[0])
    ).rejects.toThrow();
    expect(mockWaitListMemberRepo.findByEmailAndFeature).not.toHaveBeenCalled();
    expect(mockWaitListMemberRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it.each(['findByEmailAndFeature', 'create'] as const)(
    'propagates %s failure',
    async (method) => {
      const failure = new Error('storage failed');
      mockWaitListMemberRepo[method].mockRejectedValue(failure);
      await expect(usecase(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
});
