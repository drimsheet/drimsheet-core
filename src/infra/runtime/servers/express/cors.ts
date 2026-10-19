import corsMiddleware, { CorsOptions } from 'cors';

import appError from '@shared/values/errors/app.error';

import { CORS_WHITELIST } from '@infra/config/cors.config';

export default function cors() {
  const options: CorsOptions = {
    credentials: true,
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (CORS_WHITELIST.includes(origin)) {
        callback(null, true);
      } else {
        callback(new appError.Forbidden());
      }
    },
  };
  return corsMiddleware(options);
}
