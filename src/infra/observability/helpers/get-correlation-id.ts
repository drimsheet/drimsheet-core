import IAppContextService from '@shared/contracts/app-context.service.contract';
import stringUtils from '@shared/utils/string';

import { IAppContextData } from '@app/context/types/app-context.types';

import appContext from '@infra/services/app-context.service';

type TCorrelationContext = Pick<IAppContextService<IAppContextData>, 'get'>;

export default function safeGetCorrelationId(
  context: TCorrelationContext = appContext
): string | undefined {
  try {
    const correlationId = context.get().correlationId;

    return stringUtils.isUUID(correlationId) ? correlationId : undefined;
  } catch {
    return undefined;
  }
}
