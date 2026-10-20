import { Server } from 'node:http';

import request from 'supertest';

import { closeTestServer, startTestServer } from './http-listener';

describe('HTTP listener fixture', () => {
  it('binds to IPv4, serves the supplied handler, and releases the listener', async () => {
    const server = await startTestServer((_req, res) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ source: 'test-handler' }));
    });

    try {
      expect(server.address()).toEqual(
        expect.objectContaining({ address: '127.0.0.1', family: 'IPv4' })
      );
      const response = await request(server).post('/work');
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ source: 'test-handler' });
    } finally {
      await closeTestServer(server);
    }

    expect(server.listening).toBe(false);
    expect(server.address()).toBeNull();
  });

  it('rejects when binding fails instead of leaving setup pending', async () => {
    const failure = new Error('Cannot bind test listener');
    const listen = jest
      .spyOn(Server.prototype, 'listen')
      .mockImplementationOnce(function (this: Server) {
        setImmediate(() => this.emit('error', failure));
        return this;
      });

    try {
      await expect(startTestServer(() => {})).rejects.toBe(failure);
    } finally {
      listen.mockRestore();
    }
  });

  it('propagates errors when closing a server that is not running', async () => {
    await expect(closeTestServer(new Server())).rejects.toMatchObject({
      code: 'ERR_SERVER_NOT_RUNNING',
    });
  });
});
