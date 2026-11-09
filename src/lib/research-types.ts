import type { Assumptions, Dataset } from './types.ts';

export type AgentRole = 'reports' | 'fundamentals' | 'dcf';
export interface EvidenceItem {
  id: string;
  label: string;
  text: string;
  inputs: string[];
  value?: number | null;
  unit?: string;
}
export interface AgentResult {
  role: AgentRole;
  mode: 'deterministic';
  highlights: string[];
  evidence: EvidenceItem[];
  trace: { tool: string; status: 'ok' | 'rejected'; evidenceIds: string[] }[];
}
export interface ResearchRun {
  id: string;
  createdAt: string;
  inputHash: string;
  calculationVersion: string;
  workflowVersion: string;
  company: string;
  agents: AgentResult[];
}
export interface ResearchRequest {
  historyYears: number;
  source:
    | { kind: 'demo' }
    | {
        kind: 'sec';
        cik: string;
        years: number;
        sha256: string;
        review: NonNullable<NonNullable<Dataset['sec']>['review']>;
      };
  assumptions: Assumptions | null;
  approved: boolean;
  assumptionNotes?: string;
}
