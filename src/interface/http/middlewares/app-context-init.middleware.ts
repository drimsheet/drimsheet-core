import { RequestHandler, Response } from 'express';

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IVarsConfig from '@shared/contracts/vars-config.contract';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';

import { IAppContextData } from '@app/context/types/app-context.types';

import getHttpHeaderValue from '@interface/http/helpers/get-http-header-value';

function handleSetRefreshToken(
  res: Response,
  token: string,
  varsConfig: IVarsConfig
) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: varsConfig.NODE_ENV === 'production',
    path: '/api/v1/auth',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 15,
  });
}

function handleClearRefreshToken(res: Response, varsConfig: IVarsConfig) {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: varsConfig.NODE_ENV === 'production',
    path: '/api/v1/auth',
    sameSite: 'lax',
  });
}

/**
 * DOMAIN: global
 *
 * This middleware is used to initialize the request context
 */
export default function makeAppContextInitMiddleware(
  appContext: IAppContextService<IAppContextData>,
  varsConfig: IVarsConfig
): RequestHandler {
  return (req, res, next) => {
    const suppliedCorrelationId = getHttpHeaderValue(
      'x-correlation-id',
      req.headers
    );
    const correlationId =
      typeof suppliedCorrelationId === 'string' &&
      stringUtils.isUUID(suppliedCorrelationId)
        ? suppliedCorrelationId
        : generateUUID();
    const idempotencyKey = getHttpHeaderValue('x-idempotency-key', req.headers);

    res.setHeader('x-correlation-id', correlationId);

    appContext.init(
      {
        correlationId,
        idempotencyKey: idempotencyKey || '',
        clientSession: {
          setRefreshToken: (token: string) =>
            handleSetRefreshToken(res, token, varsConfig),
          getRefreshToken: () => {
            return req.cookies?.refresh_token ?? null;
          },
          clearRefreshToken: () => handleClearRefreshToken(res, varsConfig),
        },
      },
      next
    );
  };
}
