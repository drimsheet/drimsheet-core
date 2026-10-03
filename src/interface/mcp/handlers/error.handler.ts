import { CallToolResult } from '@modelcontextprotocol/server';

import IReporter from '@shared/contracts/reporter.contract';
import { EErrorKeyStatusSuffix } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

/** Return only public error keys; unexpected failures are reported once. */
export default function makeMcpErrorHandler(reporter: IReporter) {
  return (error: unknown): CallToolResult => {
    const parsedError = errorUtils.parseError(error);
    const isUnexpected =
      !parsedError.errorKey ||
      parsedError.errorKey.startsWith('error_') ||
      parsedError.errorKeyStatusSuffix === EErrorKeyStatusSuffix.Unexpected;

    if (isUnexpected) {
      reporter.report('mcp.tool.failed', error);
    }

    const errorKey = isUnexpected
      ? new appError.InternalServerError().errorKey
      : parsedError.errorKey;

    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ errorKey }) }],
    };
  };
}
