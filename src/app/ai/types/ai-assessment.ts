export type TAiAssessmentValue<T> = T | '__undetermined__';

export interface IAiAssessment<T> {
  value: TAiAssessmentValue<T>;
  confidence: number;
  evidence: string[];
}
