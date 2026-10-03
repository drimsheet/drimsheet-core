import { RequestHandler } from 'express';

interface IDependencies {
  isReady: () => Promise<boolean>;
}

/** Serve minimal, uncached health responses without normal request context. */
export default function makeHealthHandlers(deps: IDependencies) {
  const live: RequestHandler = (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({ status: 'ok' });
  };

  const ready: RequestHandler = async (_request, response) => {
    response.set('Cache-Control', 'no-store');

    const isReady = await deps.isReady();
    response
      .status(isReady ? 200 : 503)
      .json({ status: isReady ? 'ok' : 'unavailable' });
  };

  return Object.freeze({ live, ready });
}
