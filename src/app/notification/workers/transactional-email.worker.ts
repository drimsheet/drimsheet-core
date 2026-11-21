import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ITransactionalEmailAgent from '@app/notification/contracts/clients/transactional-email-agent.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';
import { transactionalEmailDtoSchema } from '@app/notification/dtos/transactional-email/transactional-email.dto.validation';

interface IDependencies {
  mailer: ITransactionalEmailAgent;
}

export default function makeTransactionalEmailWorker(deps: IDependencies) {
  return async (payload: ITransactionalEmailDto) => {
    zodValidationRunner(transactionalEmailDtoSchema, payload);

    await deps.mailer.send(payload);
  };
}
