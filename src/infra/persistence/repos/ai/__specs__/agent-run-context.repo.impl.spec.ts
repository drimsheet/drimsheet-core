import generateUUID from '@shared/utils/uuid-generator';

import agentRunContextRepo from '@infra/persistence/repos/ai/agent-run-context.repo.impl';

const mockInsertOne = jest.fn();
const mockReplaceOne = jest.fn();
const mockFindOne = jest.fn();
const mockCollection = jest.fn(() => ({
  insertOne: mockInsertOne,
  replaceOne: mockReplaceOne,
  findOne: mockFindOne,
}));

jest.mock('@infra/config/mongodb.config', () => ({
  getMongoClient: () => ({ db: () => ({ collection: mockCollection }) }),
}));

describe('agentRunContextRepo', () => {
  const id = generateUUID();
  const fields = {
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: new Date('2026-11-20T10:00:00.000Z'),
    completedOn: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockCollection.mockReturnValue({
      insertOne: mockInsertOne,
      replaceOne: mockReplaceOne,
      findOne: mockFindOne,
    });
  });

  it('inserts a new agent run context with its ID as the MongoDB key', async () => {
    await agentRunContextRepo.create({ id, ...fields });

    expect(mockCollection).toHaveBeenCalledWith('run_contexts');
    expect(mockInsertOne).toHaveBeenCalledWith({ _id: id, ...fields });
  });

  it('updates an existing agent run context without upserting', async () => {
    const completedOn = new Date('2026-11-20T10:01:00.000Z');
    await agentRunContextRepo.update({ id, ...fields, completedOn });

    expect(mockCollection).toHaveBeenCalledWith('run_contexts');
    expect(mockReplaceOne).toHaveBeenCalledWith(
      { _id: id },
      { ...fields, completedOn }
    );
  });

  it('returns the run context with its application ID', async () => {
    mockFindOne.mockResolvedValue({ _id: id, ...fields });

    await expect(agentRunContextRepo.findById(id)).resolves.toEqual({
      id,
      ...fields,
    });

    expect(mockFindOne).toHaveBeenCalledWith({ _id: id });
  });

  it('returns null when a run context is missing', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(agentRunContextRepo.findById(id)).resolves.toBeNull();
  });
});
