import { transactionalEmailDtoSchema } from '@app/notification/dtos/transactional-email/transactional-email.dto.validation';

describe('Transactional Email DTO Validation', () => {
  it('should validate a correct transactional email DTO payload', () => {
    const payload = {
      emails: ['user1@example.com', 'user2@example.com'],
      subject: 'Welcome to Drimsheet',
      html: '<h1>Welcome!</h1>',
      templateId: 'welcome-template',
      data: {
        username: 'John Doe',
      },
    };

    const result = transactionalEmailDtoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should validate with optional fields omitted', () => {
    const payload = {
      emails: ['user@example.com'],
      subject: 'Alert',
      html: '<p>Alert info</p>',
    };

    const result = transactionalEmailDtoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should fail validation if emails is invalid format', () => {
    const payload = {
      emails: ['invalid-email'],
      subject: 'Alert',
      html: '<p>Alert info</p>',
    };

    const result = transactionalEmailDtoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail validation if subject is too short', () => {
    const payload = {
      emails: ['user@example.com'],
      subject: 'Hi', // less than 3 chars
      html: '<p>Alert info</p>',
    };

    const result = transactionalEmailDtoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail validation if subject is too long', () => {
    const payload = {
      emails: ['user@example.com'],
      subject: 'a'.repeat(201),
      html: '<p>Alert info</p>',
    };

    const result = transactionalEmailDtoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
