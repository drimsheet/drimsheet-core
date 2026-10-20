import z from 'zod';

export const transactionalEmailDtoSchema = z.object({
  emails: z.array(z.email()),
  subject: z.string().min(3).max(200),
  html: z.string(),
  templateId: z.string().optional(),
  data: z.record(z.string(), z.string()).optional(),
});
