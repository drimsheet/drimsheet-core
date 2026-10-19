import { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';

import vars from '@infra/config/vars.config';

import swaggerDoc from '../../../../../generated/swagger.json';

export default function swagger() {
  const isSupportedEnv = ['development', 'local'].includes(vars.APP_ENV);

  if (!isSupportedEnv) {
    const dummy: RequestHandler = (req, res, next) => {
      next();
    };
    return [dummy];
  }

  swaggerDoc.servers = [
    {
      url: `${vars.APP_URL}/api/v1`,
    },
  ];

  return [swaggerUi.serve, swaggerUi.setup(swaggerDoc)];
}
