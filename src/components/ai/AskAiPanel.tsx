'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './AskAiPanel.module.css';

type ChartDatum = Record<string, string | number | null>;

type AskAiReply = {
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

type AskAiApiSuccess = {
  data: {
    reply: AskAiReply;
    modelUsed?: string;
    retrievedContext: Array<{
      referenceId: string;
      title: string;
      source: string;
    }>;
  };
  error: null;
};

type AskAiModelOptionsSuccess = {
  data: {
    models: string[];
    defaultModel: string;
  };
  error: null;
};

type ChatMessage =
  | {
      id: string;
      role: 'user';
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      role: 'assistant';
      content: AskAiReply;
      createdAt: string;
      context: Array<{
        referenceId: string;
        title: string;
        source: string;
      }>;
    };

const STORAGE_KEY = 'ask-ai-chat-v1';

const PRESET_QUESTIONS = [
  'Which cohort currently shows the strongest trial matching precision and why?',
  'Which data source has the weakest quality trend and what action should we take?',
  'Which studies are most at risk based on recent cohort run failures?',
  'Which federated nodes are degraded or offline and what impact should we expect?',
  'What is the best operational decision for improving trial matching outcomes this week?',
];

function VisualizationPreview({ visualization }: { visualization: AskAiReply['recommendedVisualization'] }) {
  if (!visualization) return null;

  const rows = visualization.data.slice(0, 8);
  const values = rows
    .map((row) => Number(row[visualization.yKey]))
    .filter((value) => Number.isFinite(value));
  const maxValue = values.length > 0 ? Math.max(...values, 1) : 1;

  return (
    <div className={styles.section}>
      <h4>Recommended Visualization</h4>
      <p className={styles.smallMuted}>
        {visualization.chartType} | X: {visualization.xAxis} | Y: {visualization.yAxis}
      </p>
      {visualization.notes ? <p className={styles.smallMuted}>{visualization.notes}</p> : null}

      {rows.length > 0 ? (
        <div className={styles.chartList}>
          {rows.map((row, index) => {
            const xLabel = String(row[visualization.xKey] ?? `Item ${index + 1}`);
            const yValue = Number(row[visualization.yKey]);
            const safeValue = Number.isFinite(yValue) ? yValue : 0;
            const width = (safeValue / maxValue) * 100;

            return (
              <div key={`${xLabel}-${index}`} className={styles.chartRow}>
                <span className={styles.chartLabel}>{xLabel}</span>
                <div className={styles.chartTrack}>
                  <div className={styles.chartFill} style={{ width: `${width}%` }} />
                </div>
                <span className={styles.chartValue}>{safeValue.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function toHistoryPayload(messages: ChatMessage[]) {
  return messages.slice(-8).map((message) => {
    if (message.role === 'user') {
      return { role: 'user' as const, content: message.content };
    }

    const findings = message.content.keyFindings.slice(0, 3).join('; ');
    return {
      role: 'assistant' as const,
      content: `${message.content.answer}${findings ? ` Findings: ${findings}` : ''}`,
    };
  });
}

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const maybe = item as Record<string, unknown>;
      return maybe.id != null && maybe.role != null && maybe.createdAt != null;
    });
  } catch {
    return [];
  }
}

export function AskAiPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(loadStoredMessages());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    if (availableModels.length > 0) return;

    let active = true;

    async function loadModelOptions() {
      try {
        const response = await fetch('/api/ask-ai', { method: 'GET' });
        const payload = (await response.json()) as
          | AskAiModelOptionsSuccess
          | {
              data: null;
              error: {
                code: string;
                message: string;
              };
            };

        if (!response.ok || !('data' in payload) || !payload.data) return;
        if (!active) return;

        setAvailableModels(payload.data.models);
        setSelectedModel(payload.data.defaultModel);
      } catch {
        // Keep UI usable with backend default model when options fetch fails.
      }
    }

    void loadModelOptions();
    return () => {
      active = false;
    };
  }, [open, availableModels.length]);

  const canSend = question.trim().length >= 4 && !loading;

  async function submitQuestion(rawQuestion: string) {
    const cleanQuestion = rawQuestion.trim();
    if (!cleanQuestion || cleanQuestion.length < 4 || loading) return;

    setError(null);
    setLoading(true);

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanQuestion,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion('');

    try {
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: cleanQuestion,
          model: selectedModel || undefined,
          history: toHistoryPayload(nextMessages),
        }),
      });

      const payload = (await response.json()) as
        | AskAiApiSuccess
        | {
            data: null;
            error: {
              code: string;
              message: string;
            };
          };

      if (!response.ok || !('data' in payload) || !payload.data) {
        const message = 'error' in payload && payload.error?.message ? payload.error.message : 'Ask AI request failed.';
        throw new Error(message);
      }

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: payload.data.reply,
        createdAt: new Date().toISOString(),
        context: payload.data.retrievedContext,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Ask AI request failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    setError(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Ask AI
      </Button>

      {open ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Ask AI panel">
          <button type="button" className={styles.backdrop} onClick={() => setOpen(false)} aria-label="Close Ask AI panel" />

          <aside className={styles.panel}>
            <header className={styles.header}>
              <div>
                <p className={styles.kicker}>Clinical Decision Intelligence</p>
                <h3 className={styles.title}>Ask AI</h3>
              </div>
              <div className={styles.headerActions}>
                <button type="button" className={styles.inlineButton} onClick={clearHistory}>
                  Clear
                </button>
                <button type="button" className={styles.inlineButton} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </header>

            <div className={styles.presets}>
              {PRESET_QUESTIONS.map((preset) => (
                <button key={preset} type="button" className={styles.presetButton} onClick={() => submitQuestion(preset)} disabled={loading}>
                  {preset}
                </button>
              ))}
            </div>

            <div className={styles.messages} ref={scrollRef}>
              {messages.length === 0 ? (
                <div className={styles.emptyState}>
                  Ask about cohorts, studies, trial outcomes, node health, and data quality. Responses are constrained to your dataset context.
                </div>
              ) : null}

              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className={`${styles.message} ${styles.userMessage}`}>
                    <p>{message.content}</p>
                  </div>
                ) : (
                  <div key={message.id} className={`${styles.message} ${styles.assistantMessage}`}>
                    <div className={styles.section}>
                      <h4>Answer</h4>
                      <p>{message.content.answer}</p>
                    </div>

                    {message.content.keyFindings.length > 0 ? (
                      <div className={styles.section}>
                        <h4>Key Findings</h4>
                        <ul>
                          {message.content.keyFindings.map((finding, index) => (
                            <li key={`${message.id}-finding-${index}`}>{finding}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {message.content.evidence.length > 0 ? (
                      <div className={styles.section}>
                        <h4>Evidence</h4>
                        <ul>
                          {message.content.evidence.map((evidence, index) => (
                            <li key={`${message.id}-evidence-${index}`}>
                              {evidence.detail}
                              {evidence.metric ? <span className={styles.metricBadge}>{evidence.metric}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {message.content.reasoning.length > 0 ? (
                      <div className={styles.section}>
                        <h4>Reasoning</h4>
                        <ol>
                          {message.content.reasoning.map((step, index) => (
                            <li key={`${message.id}-reason-${index}`}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    <div className={styles.section}>
                      <h4>Validation</h4>
                      <p>{message.content.validation}</p>
                    </div>

                    {message.content.limitations.length > 0 ? (
                      <div className={styles.section}>
                        <h4>Limitations</h4>
                        <ul>
                          {message.content.limitations.map((limitation, index) => (
                            <li key={`${message.id}-limitation-${index}`}>{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <VisualizationPreview visualization={message.content.recommendedVisualization} />

                    {message.content.recommendedDecision ? (
                      <div className={styles.decisionCard}>
                        <p className={styles.decisionAction}>
                          <strong>Recommended decision:</strong> {message.content.recommendedDecision.action}
                        </p>
                        <p className={styles.decisionImpact}>Expected impact: {message.content.recommendedDecision.expectedImpact}</p>
                      </div>
                    ) : null}

                    {message.context.length > 0 ? (
                      <div className={styles.contextTags}>
                        {message.context.map((item) => (
                          <span key={item.referenceId} className={styles.contextTag} title={item.referenceId}>
                            {item.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ),
              )}

              {loading ? <div className={styles.loading}>Analyzing clinical dataset context...</div> : null}
              {error ? <div className={styles.error}>{error}</div> : null}
            </div>

            <footer className={styles.footer}>
              <textarea
                className={styles.textarea}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about cohorts, study performance, trial matching, quality, or node health..."
                rows={3}
              />
              <div className={styles.footerActions}>
                <div className={styles.controls}>
                  <div className={styles.modelControl}>
                    <label htmlFor="ask-ai-model" className={styles.modelLabel}>
                      Model
                    </label>
                    <select
                      id="ask-ai-model"
                      className={styles.modelSelect}
                      value={selectedModel}
                      onChange={(event) => setSelectedModel(event.target.value)}
                      disabled={loading || availableModels.length === 0}
                    >
                      {availableModels.length === 0 ? <option value="">Default Model</option> : null}
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.hint}>Only organization-scoped dataset context is used for analysis.</p>
                </div>
                <Button onClick={() => submitQuestion(question)} disabled={!canSend}>
                  {loading ? 'Thinking...' : 'Send'}
                </Button>
              </div>
            </footer>

          </aside>
        </div>
      ) : null}
    </>
  );
}
