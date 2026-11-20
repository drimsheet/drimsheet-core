import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  InvalidId: 'app_error_agent_context_id_invalid',
  InvalidCorrelationId: 'app_error_agent_context_correlation_id_invalid',
} as const satisfies TErrorKeys<'app_error_agent_context'>;

type UAgentContextError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class AgentContextAppError extends appError.Base<UAgentContextError> {
  constructor(key: UAgentContextError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'AgentContextAppError';
  }
}

const agentContextAppError = Object.freeze({
  Base: AgentContextAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, AgentContextAppError),
});

export default agentContextAppError;
