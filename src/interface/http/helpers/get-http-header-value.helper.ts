import { IncomingHttpHeaders } from 'node:http';

export default function getHttpHeaderValueHelper(
  headerName: string,
  headers: IncomingHttpHeaders
) {
  const headerValue = headers[headerName];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}
