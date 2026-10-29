import { UWaitListFeature } from '@domain/user/types/waitlist-member.types';

export interface IJoinWaitListDto {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  feature: UWaitListFeature;
}
