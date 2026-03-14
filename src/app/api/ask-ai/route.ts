import { z } from 'zod';
import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { serverEnv, requireOpenAiKey } from '@/lib/config/env.server';
import { getPrimaryOrgContext } from '@/server/services/org-context';

type ContextDoc = {
  referenceId: string;
  title: string;
  source: string;
  text: string;
  createdAt?: string | null;
};

type ChartDatum = Record<string, string | number | null>;

type ClinicalAiResponse = {
  answer: string;
  keyFindings: string[];
  evidence: Array<{
    referenceId: string;
    detail: string;
    metric?: string;
  }>;
  reasoning: string[];
  validation: string;
  limitations: string[];
  recommendedVisualization: {
    chartType: string;
    xAxis: string;
    yAxis: string;
    xKey: string;
    yKey: string;
    data: ChartDatum[];
    notes?: string;
  } | null;
  recommendedDecision: {
    action: string;
    expectedImpact: string;
  } | null;
};

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const askAiRequestSchema = z.object({
  question: z.string().trim().min(4).max(2000),
  model: z.string().trim().min(1).max(80).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12)
    .optional(),
});

const clinicalAiResponseSchema = z.object({
  answer: z.string().trim().min(1),
  keyFindings: z.array(z.string().trim()).max(12),
  evidence: z.array(
    z.object({
      referenceId: z.string().trim().min(1),
      detail: z.string().trim().min(1),
      metric: z.string().trim().min(1).optional(),
    }),
  ),
  reasoning: z.array(z.string().trim().min(1)).max(12),
  validation: z.string().trim().min(1),
  limitations: z.array(z.string().trim().min(1)).max(12),
  recommendedVisualization: z
    .object({
      chartType: z.string().trim().min(1),
      xAxis: z.string().trim().min(1),
      yAxis: z.string().trim().min(1),
      xKey: z.string().trim().min(1),
      yKey: z.string().trim().min(1),
      data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(24),
      notes: z.string().trim().min(1).optional(),
    })
    .nullable(),
  recommendedDecision: z
    .object({
      action: z.string().trim().min(1),
      expectedImpact: z.string().trim().min(1),
    })
    .nullable(),
});

const openAiResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'clinical_ai_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'answer',
        'keyFindings',
        'evidence',
        'reasoning',
        'validation',
        'limitations',
        'recommendedVisualization',
        'recommendedDecision',
      ],
      properties: {
        answer: { type: 'string' },
        keyFindings: {
          type: 'array',
          items: { type: 'string' },
        },
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['referenceId', 'detail'],
            properties: {
              referenceId: { type: 'string' },
              detail: { type: 'string' },
              metric: { type: 'string' },
            },
          },
        },
        reasoning: {
          type: 'array',
          items: { type: 'string' },
        },
        validation: { type: 'string' },
        limitations: {
          type: 'array',
          items: { type: 'string' },
        },
        recommendedVisualization: {
          type: ['object', 'null'],
          additionalProperties: false,
          required: ['chartType', 'xAxis', 'yAxis', 'xKey', 'yKey', 'data'],
          properties: {
            chartType: { type: 'string' },
            xAxis: { type: 'string' },
            yAxis: { type: 'string' },
            xKey: { type: 'string' },
            yKey: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: {
                  type: ['string', 'number', 'null'],
                },
              },
            },
            notes: { type: 'string' },
          },
        },
        recommendedDecision: {
          type: ['object', 'null'],
          additionalProperties: false,
          required: ['action', 'expectedImpact'],
          properties: {
            action: { type: 'string' },
            expectedImpact: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are a Clinical Research AI Analyst working inside a Federated Clinical AI Platform.

Your job is to answer questions using ONLY the provided data sources:
- Retrieved RAG context
- Structured clinical datasets
- Cohort statistics
- Study data
- Federated node summaries

You must NOT invent information.

If the answer cannot be determined from the provided data, say exactly:
"Insufficient evidence in the available dataset."

Your responsibilities:
1. Analyze clinical data carefully.
2. Retrieve relevant information from the provided RAG context.
3. Use structured reasoning to interpret trends and relationships.
4. Provide evidence-backed insights.
5. Recommend decisions when appropriate.
6. Explain why the conclusion is valid.
7. Provide data references and metrics used in reasoning.
8. Generate chart instructions when useful.

Hard constraints:
- Never produce medical claims without supporting evidence from the provided data.
- Every evidence item MUST include a referenceId that exists in Context Data.
- If evidence is weak or missing, explicitly state uncertainty.
- Keep outputs concise and operational.
- Do not produce markdown. Return valid JSON only.`;

const DEFAULT_ASK_AI_MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini', 'gpt-5'] as const;

function getAskAiModelOptions() {
  const configured = (serverEnv.OPENAI_ASK_AI_MODELS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const models = configured.length > 0 ? Array.from(new Set(configured)) : [...DEFAULT_ASK_AI_MODELS];
  const defaultModel = serverEnv.OPENAI_MODEL && models.includes(serverEnv.OPENAI_MODEL) ? serverEnv.OPENAI_MODEL : models[0];

  return { models, defaultModel };
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreContextDoc(questionTokens: string[], questionText: string, doc: ContextDoc) {
  const haystack = `${doc.title} ${doc.text}`.toLowerCase();
  let score = 0;

  for (const token of questionTokens) {
    if (haystack.includes(token)) score += 2;
  }

  const phrase = questionText.toLowerCase().trim();
  if (phrase.length > 8 && haystack.includes(phrase)) score += 8;

  if (doc.source === 'cohort_run' || doc.source === 'trial_match') score += 1;

  const recencyMs = doc.createdAt ? Date.now() - new Date(doc.createdAt).getTime() : Number.POSITIVE_INFINITY;
  if (Number.isFinite(recencyMs)) {
    const days = recencyMs / (1000 * 60 * 60 * 24);
    if (days <= 30) score += 1;
    if (days <= 7) score += 1;
  }

  return score;
}

function safeJson(value: unknown, fallback = '{}') {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function summarizeJson(value: unknown, maxLen = 180) {
  const raw = safeJson(value, '{}');
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}...`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildChartDataByCohort(matches: TrialMatchRow[], cohortById: Map<string, string>) {
  const byCohort = new Map<string, { eligible: number; screened: number; precision: number[] }>();

  for (const match of matches) {
    const key = match.cohort_id ?? 'unassigned';
    const bucket = byCohort.get(key) ?? { eligible: 0, screened: 0, precision: [] };
    bucket.eligible += Number(match.eligibility_count ?? 0);
    bucket.screened += Number(match.screened_count ?? 0);
    if (typeof match.precision_score === 'number') bucket.precision.push(match.precision_score);
    byCohort.set(key, bucket);
  }

  return Array.from(byCohort.entries())
    .map(([cohortId, bucket]) => ({
      cohort: cohortById.get(cohortId) ?? (cohortId === 'unassigned' ? 'Unassigned' : cohortId),
      eligible: bucket.eligible,
      screened: bucket.screened,
      precision: Number(average(bucket.precision).toFixed(2)),
    }))
    .sort((a, b) => b.precision - a.precision)
    .slice(0, 8);
}

function buildCohortRunSummary(
  runs: CohortRunRow[],
  versionToCohortId: Map<string, string>,
  cohortById: Map<string, string>,
) {
  const byCohort = new Map<string, { completed: number; failed: number; totalRuns: number; totalResults: number }>();

  for (const run of runs) {
    const cohortId = versionToCohortId.get(run.cohort_version_id);
    if (!cohortId) continue;

    const bucket = byCohort.get(cohortId) ?? {
      completed: 0,
      failed: 0,
      totalRuns: 0,
      totalResults: 0,
    };

    bucket.totalRuns += 1;
    if (run.status === 'completed') bucket.completed += 1;
    if (run.status === 'failed') bucket.failed += 1;
    if (typeof run.result_count === 'number') bucket.totalResults += run.result_count;

    byCohort.set(cohortId, bucket);
  }

  return Array.from(byCohort.entries())
    .map(([cohortId, bucket]) => ({
      cohortId,
      cohortName: cohortById.get(cohortId) ?? cohortId,
      totalRuns: bucket.totalRuns,
      completed: bucket.completed,
      failed: bucket.failed,
      completionRate: bucket.totalRuns > 0 ? Number(((bucket.completed / bucket.totalRuns) * 100).toFixed(2)) : 0,
      totalResults: bucket.totalResults,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10);
}

function buildContextDocs(input: {
  studies: StudyRow[];
  cohorts: CohortRow[];
  cohortRuns: CohortRunRow[];
  cohortVersions: CohortVersionRow[];
  clinicalTrials: ClinicalTrialRow[];
  trialMatches: TrialMatchRow[];
  federatedNodes: FederatedNodeRow[];
  qualityMetrics: QualityMetricRow[];
  reports: RweReportRow[];
}) {
  const docs: ContextDoc[] = [];
  const studyById = new Map(input.studies.map((study) => [study.id, study]));
  const cohortById = new Map(input.cohorts.map((cohort) => [cohort.id, cohort.name]));
  const versionToCohortId = new Map(input.cohortVersions.map((version) => [version.id, version.cohort_id]));
  const trialById = new Map(input.clinicalTrials.map((trial) => [trial.id, trial]));

  for (const study of input.studies) {
    docs.push({
      referenceId: `study:${study.id}`,
      title: `Study ${study.name}`,
      source: 'study',
      text: `Status: ${study.status}. Description: ${study.description ?? 'n/a'}. Updated: ${study.updated_at}.`,
      createdAt: study.updated_at,
    });
  }

  for (const cohort of input.cohorts) {
    const linkedStudy = cohort.study_id ? studyById.get(cohort.study_id) : null;
    docs.push({
      referenceId: `cohort:${cohort.id}`,
      title: `Cohort ${cohort.name}`,
      source: 'cohort',
      text: `Study: ${linkedStudy?.name ?? 'Unassigned'}. Description: ${cohort.description ?? 'n/a'}. Created: ${cohort.created_at}.`,
      createdAt: cohort.created_at,
    });
  }

  for (const run of input.cohortRuns) {
    const cohortId = versionToCohortId.get(run.cohort_version_id);
    const cohortName = cohortId ? cohortById.get(cohortId) ?? cohortId : 'Unknown Cohort';
    docs.push({
      referenceId: `cohort_run:${run.id}`,
      title: `Cohort Run ${cohortName}`,
      source: 'cohort_run',
      text: `Status: ${run.status}. Result count: ${run.result_count ?? 'n/a'}. Started: ${run.started_at ?? 'n/a'}. Finished: ${run.finished_at ?? 'n/a'}.`,
      createdAt: run.created_at,
    });
  }

  for (const trial of input.clinicalTrials) {
    const linkedStudy = trial.study_id ? studyById.get(trial.study_id) : null;
    docs.push({
      referenceId: `trial:${trial.id}`,
      title: `Trial ${trial.trial_code}`,
      source: 'trial',
      text: `Title: ${trial.title}. Phase: ${trial.phase}. Status: ${trial.status}. Study: ${linkedStudy?.name ?? 'Unlinked'}. Target enrollment: ${trial.target_enrollment ?? 'n/a'}.`,
      createdAt: trial.created_at,
    });
  }

  for (const match of input.trialMatches) {
    const trial = trialById.get(match.trial_id);
    const cohortName = match.cohort_id ? cohortById.get(match.cohort_id) ?? match.cohort_id : 'Unassigned';
    docs.push({
      referenceId: `trial_match:${match.id}`,
      title: `Trial Match ${trial?.trial_code ?? match.trial_id}`,
      source: 'trial_match',
      text: `Trial: ${trial?.title ?? 'Unknown'}. Cohort: ${cohortName}. Eligible: ${match.eligibility_count}. Screened: ${match.screened_count}. Precision score: ${match.precision_score ?? 'n/a'}%. Status: ${match.status}.`,
      createdAt: match.matched_at,
    });
  }

  for (const node of input.federatedNodes) {
    docs.push({
      referenceId: `node:${node.id}`,
      title: `Federated Node ${node.name}`,
      source: 'federated_node',
      text: `Region: ${node.region}. Status: ${node.status}. Last heartbeat: ${node.last_heartbeat_at ?? 'n/a'}. Capabilities: ${summarizeJson(node.capabilities)}.`,
      createdAt: node.updated_at,
    });
  }

  for (const metric of input.qualityMetrics) {
    docs.push({
      referenceId: `quality_metric:${metric.id}`,
      title: `Quality Metric ${metric.metric_name}`,
      source: 'quality_metric',
      text: `Source: ${metric.source_name}. Value: ${metric.metric_value}. Status: ${metric.status}. Measured at: ${metric.measured_at}.`,
      createdAt: metric.measured_at,
    });
  }

  for (const report of input.reports) {
    const linkedStudy = report.study_id ? studyById.get(report.study_id) : null;
    docs.push({
      referenceId: `report:${report.id}`,
      title: `RWE Report ${report.report_name}`,
      source: 'rwe_report',
      text: `Type: ${report.report_type}. Status: ${report.status}. Study: ${linkedStudy?.name ?? 'Unlinked'}. Generated at: ${report.generated_at ?? 'n/a'}. Summary: ${summarizeJson(report.summary_json)}.`,
      createdAt: report.created_at,
    });
  }

  return { docs, cohortById, versionToCohortId };
}

function retrieveTopContext(question: string, docs: ContextDoc[], maxItems = 12) {
  const tokens = tokenize(question);
  const scored = docs
    .map((doc) => ({ doc, score: scoreContextDoc(tokens, question, doc) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((entry) => entry.doc);

  if (scored.length > 0) return scored;

  return docs
    .slice()
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, Math.min(6, maxItems));
}

function buildUserPrompt(input: {
  question: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  retrievedDocs: ContextDoc[];
  structuredMetrics: Record<string, unknown>;
  cohortData: Record<string, unknown>;
  studyData: Record<string, unknown>;
}) {
  const historySection = input.history
    .slice(-6)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join('\n');

  const retrievedDocsText = input.retrievedDocs
    .map((doc) => `- [${doc.referenceId}] (${doc.source}) ${doc.title}: ${doc.text}`)
    .join('\n');

  return `Context Data:
${retrievedDocsText || '- No documents retrieved.'}

Structured Metrics:
${safeJson(input.structuredMetrics)}

Recent Cohort Results:
${safeJson(input.cohortData)}

Clinical Studies:
${safeJson(input.studyData)}

Conversation History:
${historySection || 'No previous conversation.'}

User Question:
${input.question}

Requirements:
- Provide precise analysis
- Reference specific data
- Suggest decisions if relevant
- Avoid speculation
- Generate visualization instructions and data when useful
- If context is not sufficient, answer exactly: "Insufficient evidence in the available dataset."`;
}

function normalizeClinicalResponse(
  response: ClinicalAiResponse,
  validReferenceIds: Set<string>,
  fallbackChartData: ChartDatum[],
): ClinicalAiResponse {
  const evidence = response.evidence.filter((item) => validReferenceIds.has(item.referenceId));
  const insufficientMessage = 'Insufficient evidence in the available dataset.';

  if (evidence.length === 0) {
    return {
      answer: insufficientMessage,
      keyFindings: ['No verifiable evidence references were returned from retrieved dataset context.'],
      evidence: [],
      reasoning: ['Validation guard rejected non-verifiable evidence references in the model response.'],
      validation: 'Response was validated against retrieved context IDs and did not pass evidence reference checks.',
      limitations: ['Available context did not provide verifiable evidence for the requested conclusion.'],
      recommendedVisualization:
        fallbackChartData.length > 0
          ? {
              chartType: 'Bar Chart',
              xAxis: 'Cohort',
              yAxis: 'Precision',
              xKey: 'cohort',
              yKey: 'precision',
              data: fallbackChartData,
              notes: 'Fallback visualization from retrieved structured trial match data.',
            }
          : null,
      recommendedDecision: null,
    };
  }

  const visualization = response.recommendedVisualization;
  const normalizedVisualization =
    visualization && visualization.data.length > 0
      ? {
          ...visualization,
          data: visualization.data.slice(0, 24),
        }
      : fallbackChartData.length > 0
        ? {
            chartType: 'Bar Chart',
            xAxis: 'Cohort',
            yAxis: 'Precision',
            xKey: 'cohort',
            yKey: 'precision',
            data: fallbackChartData,
            notes: 'Generated from available cohort-trial matching statistics.',
          }
        : null;

  return {
    ...response,
    evidence,
    recommendedVisualization: normalizedVisualization,
  };
}

async function callOpenAi(apiKey: string, model: string, messages: OpenAiMessage[]) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: openAiResponseFormat,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OPENAI_REQUEST_FAILED:${response.status}:${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const rawContent = payload.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error('OPENAI_EMPTY_RESPONSE');
  }

  return rawContent;
}

type StudyRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
};

type CohortRow = {
  id: string;
  study_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
};

type CohortVersionRow = {
  id: string;
  cohort_id: string;
};

type CohortRunRow = {
  id: string;
  cohort_version_id: string;
  status: string;
  result_count: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type ClinicalTrialRow = {
  id: string;
  study_id: string | null;
  trial_code: string;
  title: string;
  phase: string;
  status: string;
  target_enrollment: number | null;
  created_at: string;
};

type TrialMatchRow = {
  id: string;
  trial_id: string;
  cohort_id: string | null;
  eligibility_count: number;
  screened_count: number;
  precision_score: number | null;
  status: string;
  matched_at: string;
};

type FederatedNodeRow = {
  id: string;
  name: string;
  region: string;
  status: string;
  capabilities: unknown;
  last_heartbeat_at: string | null;
  updated_at: string;
};

type QualityMetricRow = {
  id: string;
  source_name: string;
  metric_name: string;
  metric_value: number;
  status: string;
  measured_at: string;
};

type RweReportRow = {
  id: string;
  study_id: string | null;
  report_name: string;
  report_type: string;
  status: string;
  generated_at: string | null;
  summary_json: unknown;
  created_at: string;
};

export async function GET() {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) {
    return fail({ code: 'ORG_CONTEXT_MISSING', message: 'No active organization context found.' }, 403);
  }

  const { models, defaultModel } = getAskAiModelOptions();
  return ok({ models, defaultModel });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = askAiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid Ask AI payload.', details: parsed.error.flatten() }, 422);
  }

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) {
    return fail({ code: 'ORG_CONTEXT_MISSING', message: 'No active organization context found.' }, 403);
  }

  let openAiKey: string;
  try {
    openAiKey = requireOpenAiKey();
  } catch {
    return fail({ code: 'AI_NOT_CONFIGURED', message: 'OPENAI_API_KEY is missing on server.' }, 503);
  }

  const { models: allowedModels, defaultModel } = getAskAiModelOptions();
  const selectedModel = parsed.data.model && allowedModels.includes(parsed.data.model) ? parsed.data.model : defaultModel;

  const [
    studiesResult,
    cohortsResult,
    cohortVersionsResult,
    cohortRunsResult,
    clinicalTrialsResult,
    trialMatchesResult,
    federatedNodesResult,
    qualityMetricsResult,
    reportsResult,
  ] = await Promise.all([
    supabase
      .from('studies')
      .select('id, name, description, status, updated_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(120),
    supabase
      .from('cohorts')
      .select('id, study_id, name, description, created_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('cohort_versions')
      .select('id, cohort_id')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('cohort_runs')
      .select('id, cohort_version_id, status, result_count, started_at, finished_at, created_at')
      .order('created_at', { ascending: false })
      .limit(220),
    supabase
      .from('clinical_trials')
      .select('id, study_id, trial_code, title, phase, status, target_enrollment, created_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('trial_matches')
      .select('id, trial_id, cohort_id, eligibility_count, screened_count, precision_score, status, matched_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('matched_at', { ascending: false })
      .limit(260),
    supabase
      .from('federated_nodes')
      .select('id, name, region, status, capabilities, last_heartbeat_at, updated_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('data_quality_metrics')
      .select('id, source_name, metric_name, metric_value, status, measured_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('measured_at', { ascending: false })
      .limit(260),
    supabase
      .from('rwe_reports')
      .select('id, study_id, report_name, report_type, status, generated_at, summary_json, created_at')
      .eq('org_id', orgContext.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(120),
  ]);

  const studies = (studiesResult.data ?? []) as StudyRow[];
  const cohorts = (cohortsResult.data ?? []) as CohortRow[];
  const cohortVersionsRaw = (cohortVersionsResult.data ?? []) as CohortVersionRow[];
  const cohortRunsRaw = (cohortRunsResult.data ?? []) as CohortRunRow[];
  const clinicalTrials = (clinicalTrialsResult.data ?? []) as ClinicalTrialRow[];
  const trialMatches = (trialMatchesResult.data ?? []) as TrialMatchRow[];
  const federatedNodes = (federatedNodesResult.data ?? []) as FederatedNodeRow[];
  const qualityMetrics = (qualityMetricsResult.data ?? []) as QualityMetricRow[];
  const reports = (reportsResult.data ?? []) as RweReportRow[];

  const cohortIdSet = new Set(cohorts.map((cohort) => cohort.id));
  const cohortVersions = cohortVersionsRaw.filter((version) => cohortIdSet.has(version.cohort_id));
  const versionIdSet = new Set(cohortVersions.map((version) => version.id));
  const cohortRuns = cohortRunsRaw.filter((run) => versionIdSet.has(run.cohort_version_id));

  const nodeStatusCounts = federatedNodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.status] = (acc[node.status] ?? 0) + 1;
    return acc;
  }, {});

  const qualityValues = qualityMetrics
    .map((metric) => Number(metric.metric_value))
    .filter((value) => Number.isFinite(value));

  const avgPrecision = average(
    trialMatches.map((match) => (typeof match.precision_score === 'number' ? match.precision_score : Number.NaN)).filter(Number.isFinite),
  );

  const structuredMetrics = {
    organizationId: orgContext.orgId,
    totals: {
      studies: studies.length,
      activeStudies: studies.filter((study) => study.status === 'active').length,
      cohorts: cohorts.length,
      cohortRuns: cohortRuns.length,
      cohortRunSuccessRate:
        cohortRuns.length > 0
          ? Number(((cohortRuns.filter((run) => run.status === 'completed').length / cohortRuns.length) * 100).toFixed(2))
          : 0,
      trials: clinicalTrials.length,
      openTrials: clinicalTrials.filter((trial) => trial.status === 'open').length,
      trialMatches: trialMatches.length,
      totalEligiblePatients: trialMatches.reduce((sum, match) => sum + Number(match.eligibility_count ?? 0), 0),
      avgMatchPrecision: Number(avgPrecision.toFixed(2)),
      qualityMetrics: qualityMetrics.length,
      avgQualityScore: Number(average(qualityValues).toFixed(2)),
      rweReports: reports.length,
    },
    federatedNodeStatus: nodeStatusCounts,
  };

  const { docs, cohortById, versionToCohortId } = buildContextDocs({
    studies,
    cohorts,
    cohortRuns,
    cohortVersions,
    clinicalTrials,
    trialMatches,
    federatedNodes,
    qualityMetrics,
    reports,
  });

  const retrievedDocs = retrieveTopContext(parsed.data.question, docs, 12);
  const validReferenceIds = new Set(retrievedDocs.map((doc) => doc.referenceId));

  const cohortRunSummary = buildCohortRunSummary(cohortRuns, versionToCohortId, cohortById);
  const cohortPrecisionChartData = buildChartDataByCohort(trialMatches, cohortById);

  const userPrompt = buildUserPrompt({
    question: parsed.data.question,
    history: parsed.data.history ?? [],
    retrievedDocs,
    structuredMetrics,
    cohortData: {
      topCohortsByCompletionRate: cohortRunSummary,
      cohortPrecision: cohortPrecisionChartData,
    },
    studyData: {
      studies: studies.slice(0, 15),
      clinicalTrials: clinicalTrials.slice(0, 15),
      reports: reports.slice(0, 15).map((report) => ({
        id: report.id,
        report_name: report.report_name,
        report_type: report.report_type,
        status: report.status,
        generated_at: report.generated_at,
      })),
    },
  });

  const messages: OpenAiMessage[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  let rawModelOutput: string;
  try {
    rawModelOutput = await callOpenAi(openAiKey, selectedModel, messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI request failed.';
    return fail({ code: 'AI_REQUEST_FAILED', message }, 502);
  }

  let modelObject: ClinicalAiResponse;
  try {
    const parsedModelObject = JSON.parse(rawModelOutput) as unknown;
    const validated = clinicalAiResponseSchema.parse(parsedModelObject);
    modelObject = validated;
  } catch {
    return fail({ code: 'AI_RESPONSE_INVALID', message: 'Model response could not be parsed into required structure.' }, 502);
  }

  const normalized = normalizeClinicalResponse(modelObject, validReferenceIds, cohortPrecisionChartData);

  return ok({
    reply: normalized,
    modelUsed: selectedModel,
    retrievedContext: retrievedDocs.map((doc) => ({
      referenceId: doc.referenceId,
      title: doc.title,
      source: doc.source,
    })),
    metrics: structuredMetrics,
  });
}
