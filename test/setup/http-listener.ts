import { once } from 'node:events';
import { createServer, RequestListener, Server } from 'node:http';

/** Bind test requests to IPv4 and return only after the listener is ready. */
export async function startTestServer(
  handler: RequestListener
): Promise<Server> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

/** Close the suite's listener, propagating cleanup failures to the test. */
export function closeTestServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
