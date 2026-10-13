import userValueObjectError from '@domain/user/errors/user-value-object.error';

function normalize(input: string): string {
  if (typeof input !== 'string') {
    throw new userValueObjectError.InvalidType();
  }
  return input.trim().toLowerCase();
}

function isValid(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  }

  if (email.length < 3 || email.length > 254) {
    return false;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (localPart.length > 64) {
    return false;
  }

  const validLocalRegex =
    /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;

  if (!validLocalRegex.test(localPart)) {
    return false;
  }

  const domainRegex =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

  if (!domainRegex.test(domainPart)) {
    return false;
  }

  const labels = domainPart.split('.');
  if (labels.length < 2) {
    return false;
  }

  return true;
}

function validate(email: string) {
  if (!isValid(email)) {
    throw new userValueObjectError.InvalidFormat();
  }
}

function make(input: string): string {
  const normalized = normalize(input);

  validate(normalized);

  return normalized;
}

function localPart(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return email;
  }
  return email.slice(0, atIndex);
}

function domain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return '';
  }
  return email.slice(atIndex + 1);
}

const emailValue = Object.freeze({
  normalize,
  isValid,
  validate,
  make,
  localPart,
  domain,
});

export default emailValue;
