import {
  ratios,
  tryValue,
  scenarioAssumptions,
  CALCULATION_VERSION,
  valuationReadiness,
} from './finance.ts';
import type { Assumptions, Dataset } from './types.ts';
import type { SecCompanyReports } from './sec-types.ts';
import type { AgentRole, AgentResult, EvidenceItem, ResearchRun } from './research-types.ts';

export const WORKFLOW_VERSION = 'deterministic-research-2';
interface Tool {
  name: string;
  description: string;
  run: () => EvidenceItem[];
}
/** Fixed role-specific workers, not autonomous LLM agents. Every output is reproducible code. */
export function runAgent(role: AgentRole, tool: Tool): AgentResult {
  const evidence = tool.run();
  return {
    role,
    mode: 'deterministic',
    evidence,
    highlights: evidence.map((e) => e.id),
    trace: [{ tool: tool.name, status: 'ok', evidenceIds: evidence.map((e) => e.id) }],
  };
}

export async function runResearch(
  dataset: Dataset,
  assumptions: Assumptions | null,
  approved: boolean,
  reports?: SecCompanyReports,
  assumptionNotes = '',
): Promise<ResearchRun> {
  const latest = dataset.years.at(-1)!;
  const previous = dataset.years.at(-2);
  const reportEvidence: EvidenceItem[] = [
    {
      id: 'reports:identity',
      label: 'Company and history',
      text: `${dataset.company}; ${dataset.years.length} annual periods, ${dataset.years[0].periodEnd} to ${latest.periodEnd}. ${dataset.kind === 'demo' ? 'Synthetic teaching data.' : dataset.kind === 'upload' ? 'User-provided statements; not independently verified.' : 'Reviewed SEC mapping; original statements remain the authority.'}`,
      inputs: [],
    },
    {
      id: 'reports:coverage',
      label: 'Data completeness',
      text: dataset.sec
        ? dataset.sec.issues.join(' ')
        : dataset.kind === 'demo'
          ? 'Synthetic sample inputs are complete and intentionally illustrative.'
          : 'User-reviewed CSV inputs. Missing data stays unavailable; source accounts have not been independently verified.',
      inputs: [],
    },
  ];
  if (reports)
    reportEvidence.push(
      ...reports.periods.map((p) => ({
        id: `filing:${p.annual.accession}`,
        label: `Annual filing ${p.periodEnd}`,
        text: `10-K filed ${p.annual.filed}; ${p.amendments.length} amendments listed.`,
        inputs: [p.annual.indexUrl],
      })),
    );
  const metricEvidence = ratios(latest, previous).map((m) => ({
    id: `ratio:${m.id}`,
    label: m.label,
    text:
      m.value === null
        ? `Unavailable: ${m.reason}`
        : `${m.formula}. Uses the latest annual period${m.inputs.some((i) => i.startsWith(`FY${previous?.fiscalYear}:`)) ? ' and prior-year balances' : ''}.`,
    value: m.value,
    unit: m.unit,
    inputs: m.inputs,
  }));
  const dcfEvidence: EvidenceItem[] = [];
  const block =
    valuationReadiness(dataset, assumptions) ??
    (dataset.kind !== 'demo' && approved && assumptionNotes.trim().length < 20
      ? 'Document the forecast and discount-rate assumption rationale before valuation.'
      : null) ??
    (!approved
      ? 'Review and approve DCF assumptions before valuation.'
      : !assumptions
        ? 'Complete all DCF assumptions.'
        : null);
  if (block)
    dcfEvidence.push({ id: 'dcf:blocked', label: 'Valuation withheld', text: block, inputs: [] });
  else
    for (const scenario of ['Bear', 'Base', 'Bull'] as const) {
      const result = tryValue(latest, scenarioAssumptions(assumptions!, scenario));
      dcfEvidence.push({
        id: `dcf:${scenario}`,
        label: `${scenario} enterprise value`,
        text:
          result.error ??
          `Five annual FCFF projections plus discounted year-six perpetual-growth terminal value. USD millions; fiscal year-end valuation as of ${latest.periodEnd}, not a current market price target.`,
        value: result.value?.enterpriseValue ?? null,
        unit: 'money',
        inputs: [
          `FY${latest.fiscalYear}:revenue`,
          `FY${latest.fiscalYear}:operatingNwc`,
          'reviewed-assumptions',
        ],
      });
      if (scenario === 'Base' && result.value)
        dcfEvidence.push({
          id: 'dcf:terminal',
          label: 'Terminal value concentration',
          text: 'Share of enterprise value from discounted terminal value. High concentration makes long-run assumptions especially consequential.',
          value: result.value.terminalShare,
          unit: 'percent',
          inputs: ['reviewed-assumptions'],
        });
    }
  const roles: { role: AgentRole; tool: Tool }[] = [
    {
      role: 'reports',
      tool: {
        name: 'inspect_reports',
        description: 'Read identity, source coverage, missing mappings and annual filing evidence.',
        run: () => reportEvidence,
      },
    },
    {
      role: 'fundamentals',
      tool: {
        name: 'calculate_ratios',
        description:
          'Read deterministic annual ratios, formulas, missing-input reasons and evidence IDs.',
        run: () => metricEvidence,
      },
    },
    {
      role: 'dcf',
      tool: {
        name: 'calculate_dcf',
        description:
          'Read deterministic bear/base/bull DCF outputs or the reason valuation is blocked. Assumptions cannot be changed.',
        run: () => dcfEvidence,
      },
    },
  ];
  const agents: AgentResult[] = [];
  for (const r of roles) agents.push(runAgent(r.role, r.tool));
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    inputHash: [
      ...new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(
            JSON.stringify({ dataset, assumptions, approved, assumptionNotes }),
          ),
        ),
      ),
    ]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join(''),
    calculationVersion: CALCULATION_VERSION,
    workflowVersion: WORKFLOW_VERSION,
    company: dataset.company,
    agents,
  };
}
