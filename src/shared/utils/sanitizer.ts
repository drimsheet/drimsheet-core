export const SENSITIVE_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'clientsecret',
  'password',
  'pass',
  'pwd',
  'code',
  'state',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'setcookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'apikey',
  'privatekey',
  'secretkey',
  'email',
  'emails',
  'recipient',
  'recipients',
  'to',
  'cc',
  'bcc',
  'replyto',
  'username',
  'user',
  'firstname',
  'lastname',
  'fullname',
  'name',
  'address',
  'phone',
  'counterparty',
  'ip',
  'ipaddress',
  'useragent',
  'url',
  'originalurl',
  'rawurl',
  'requesturl',
  'redirecturl',
  'path',
  'headers',
  'header',
  'query',
  'querystring',
  'request',
  'req',
  'body',
  'subject',
  'html',
  'content',
  'job',
  'jobs',
  'jobdata',
  'payload',
  'payloads',
  'data',
]);

const SAFE_IDENTIFIER_KEYS = new Set(['correlationid', 'traceid', 'spanid']);

const SENSITIVE_TEXT_REGEX =
  /(token|secret|password|authorization|access_token|refresh_token|api_key|client_secret)([:=]\s*)([^\s,;]+)/gi;
const EMAIL_TEXT_REGEX =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);

  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return true;
  }
  if (normalizedKey.includes('email')) {
    return true;
  }
  if (normalizedKey.includes('recipient')) {
    return true;
  }
  if (normalizedKey.endsWith('url')) {
    return true;
  }
  if (/amount|balance|delta/.test(normalizedKey)) {
    return true;
  }

  return (
    normalizedKey.endsWith('id') && !SAFE_IDENTIFIER_KEYS.has(normalizedKey)
  );
}

function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let sanitizedString = str;

  if (sanitizedString.includes('?')) {
    sanitizedString = sanitizedString.replace(
      /([^\s?#]+)\?([^\s#]+)/g,
      (match, path, queryString) => {
        try {
          const params = new URLSearchParams(queryString);
          let modified = false;
          for (const key of Array.from(params.keys())) {
            if (isSensitiveKey(key)) {
              params.set(key, '[REDACTED]');
              modified = true;
            }
          }
          return modified ? `${path}?${params.toString()}` : match;
        } catch {
          return match;
        }
      }
    );
  }

  return sanitizedString
    .replace(
      SENSITIVE_TEXT_REGEX,
      (match, key, sep) => `${key}${sep}[REDACTED]`
    )
    .replace(EMAIL_TEXT_REGEX, '[REDACTED]');
}

export function sanitizeData(
  data: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  try {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return sanitizeString(data);
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (seen.has(data as object)) {
      return '[CIRCULAR]';
    }

    seen.add(data as object);

    if (Array.isArray(data)) {
      return data.map((item) => sanitizeData(item, seen));
    }

    if (data instanceof Date || data instanceof RegExp) {
      return data;
    }

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return data;
    }

    if (data instanceof Error) {
      const errorCopy = Object.create(Object.getPrototypeOf(data));
      Object.defineProperty(errorCopy, 'name', {
        value: sanitizeString(data.name),
        writable: true,
        configurable: true,
        enumerable: false,
      });
      Object.defineProperty(errorCopy, 'message', {
        value: sanitizeString(data.message),
        writable: true,
        configurable: true,
        enumerable: false,
      });
      if (data.stack) {
        Object.defineProperty(errorCopy, 'stack', {
          value: sanitizeString(data.stack),
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      const propNames = Object.getOwnPropertyNames(data);
      for (const key of propNames) {
        if (key === 'name' || key === 'message' || key === 'stack') {
          continue;
        }
        const value = (data as unknown as Record<string, unknown>)[key];
        (errorCopy as unknown as Record<string, unknown>)[key] = isSensitiveKey(
          key
        )
          ? '[REDACTED]'
          : sanitizeData(value, seen);
      }
      return errorCopy;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      result[key] = isSensitiveKey(key)
        ? '[REDACTED]'
        : sanitizeData(value, seen);
    }

    return result;
  } catch {
    return '[UNSERIALIZABLE]';
  }
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return url;
  }
  return sanitizeString(url);
}
