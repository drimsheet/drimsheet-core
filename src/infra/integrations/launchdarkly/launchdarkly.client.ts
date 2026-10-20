import { init } from '@launchdarkly/node-server-sdk';

import vars from '@infra/config/vars.config';

let client: ReturnType<typeof init> | undefined;

function get() {
  client ??= init(vars.LAUNCHDARKLY_SDK_KEY);
  return client;
}

// Cleanup must not create a client when startup failed before initialization.
function getInitialized() {
  return client;
}

export default Object.freeze({ get, getInitialized });
