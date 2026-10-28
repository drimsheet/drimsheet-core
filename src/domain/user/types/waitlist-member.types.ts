export const EWaitListFeature = Object.freeze({
  Mvp: 'mvp',
} as const);

export type UWaitListFeature =
  (typeof EWaitListFeature)[keyof typeof EWaitListFeature];

export interface IWaitListMember {
  firstName: string | null;
  lastName: string | null;
  email: string;
  feature: UWaitListFeature;
  createdAt: Date;
  updatedAt: Date;
}
