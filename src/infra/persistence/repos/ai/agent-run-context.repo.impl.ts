import { TEntityId } from '@shared/types/uuid';

import IAgentRunContextRepo from '@app/ai/contracts/repos/agent-run-context.repo.contract';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

import { getMongoClient } from '@infra/config/mongodb.config';

type TRunContextDocument = Omit<IAgentRunContext, 'id'> & { _id: TEntityId };

function getRunContextCollection() {
  return getMongoClient().db().collection<TRunContextDocument>('run_contexts');
}

const agentRunContextRepo: IAgentRunContextRepo = {
  async create(context) {
    const { id, ...fields } = context;
    await getRunContextCollection().insertOne({ _id: id, ...fields });
  },

  async update(context) {
    const { id, ...fields } = context;
    await getRunContextCollection().replaceOne({ _id: id }, fields);
  },
  async findById(id) {
    const document = await getRunContextCollection().findOne({ _id: id });
    if (!document) {
      return null;
    }

    const { _id, ...fields } = document;
    return { id: _id, ...fields };
  },
};

export default agentRunContextRepo;
