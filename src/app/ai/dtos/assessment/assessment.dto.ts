export type TAiAssessmentValue<T> = T | '__undetermined__';

export interface IAiAssessmentDto<T> {
  value: TAiAssessmentValue<T>;
  confidence: number;
  evidence: string[];
}
