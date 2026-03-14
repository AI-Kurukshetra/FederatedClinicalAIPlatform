'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './AskAiWorkspace.module.css';

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

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const STORAGE_KEY = 'ask-ai-conversations-v1';

const STARTER_PROMPTS = [
  'Which cohort currently has the highest trial match precision?',
  'Which sources are showing data quality regression this week?',
  'Summarize recent cohort run failures and likely causes.',
  'What should we prioritize to improve trial matching outcomes?'
];

function createConversation(title = 'New chat'): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function loadStoredConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is Conversation => {
      if (!item || typeof item !== 'object') return false;
      const maybe = item as Record<string, unknown>;
      return typeof maybe.id === 'string' && typeof maybe.title === 'string' && Array.isArray(maybe.messages);
    });
  } catch {
    return [];
  }
}

function toHistoryPayload(messages: ChatMessage[]) {
  return messages.slice(-8).map((message) => {
    if (message.role === 'user') return { role: 'user' as const, content: message.content };

    const findings = message.content.keyFindings.slice(0, 3).join('; ');
    return {
      role: 'assistant' as const,
      content: `${message.content.answer}${findings ? ` Findings: ${findings}` : ''}`,
    };
  });
}

function formatConversationTitleFromQuestion(question: string) {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

export function AskAiWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadStoredConversations();
    if (stored.length === 0) {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveConversationId(fresh.id);
      return;
    }

    setConversations(stored);
    setActiveConversationId(stored[0].id);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesScrollRef.current?.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (availableModels.length > 0) return;

    let mounted = true;

    async function loadModels() {
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

        if (!response.ok || !('data' in payload) || !payload.data || !mounted) return;
        setAvailableModels(payload.data.models);
        setSelectedModel(payload.data.defaultModel);
      } catch {
        // Keep default behavior if model listing fails.
      }
    }

    void loadModels();

    return () => {
      mounted = false;
    };
  }, [availableModels.length]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      if (conversation.title.toLowerCase().includes(query)) return true;
      return conversation.messages.some((message) => {
        if (message.role === 'user') return message.content.toLowerCase().includes(query);
        return message.content.answer.toLowerCase().includes(query);
      });
    });
  }, [conversations, search]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0] ?? null;

  function updateActiveConversation(updater: (conversation: Conversation) => Conversation) {
    if (!activeConversation) return;

    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== activeConversation.id) return conversation;
        return updater(conversation);
      }),
    );
  }

  function createNewChat() {
    const chat = createConversation();
    setConversations((current) => [chat, ...current]);
    setActiveConversationId(chat.id);
    setQuestion('');
    setError(null);
  }

  function clearActiveChat() {
    if (!activeConversation) return;

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: 'New chat',
      updatedAt: new Date().toISOString(),
      messages: [],
    }));

    setError(null);
  }

  async function submitQuestion(rawQuestion: string) {
    if (!activeConversation || loading) return;

    const cleanQuestion = rawQuestion.trim();
    if (cleanQuestion.length < 4) return;

    setLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanQuestion,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...activeConversation.messages, userMessage];
    const nextTitle =
      activeConversation.title === 'New chat' && activeConversation.messages.length === 0
        ? formatConversationTitleFromQuestion(cleanQuestion)
        : activeConversation.title;

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }));

    setQuestion('');

    try {
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      updateActiveConversation((conversation) => ({
        ...conversation,
        updatedAt: new Date().toISOString(),
        messages: [...conversation.messages, assistantMessage],
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ask AI request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Ask AI Workspace</h1>
          <p className={styles.subtitle}>Collaborate with AI for study design, cohort refinement, and operational decisions.</p>
        </div>
        <div className={styles.topActions}>
          <div className={styles.modelBox}>
            <label htmlFor="ask-ai-model">Model</label>
            <select
              id="ask-ai-model"
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
          <Button variant="secondary" onClick={createNewChat}>
            New Chat
          </Button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.historyPane}>
          <div className={styles.searchWrap}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              className={styles.searchInput}
            />
          </div>

          <div className={styles.promptSection}>
            <p className={styles.sectionLabel}>Quick prompts</p>
            <div className={styles.promptList}>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.promptButton}
                  onClick={() => void submitQuestion(prompt)}
                  disabled={loading || !activeConversation}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.chatListWrap}>
            <p className={styles.sectionLabel}>History</p>
            <div className={styles.chatList}>
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`${styles.chatItem} ${conversation.id === activeConversation?.id ? styles.chatItemActive : ''}`}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setError(null);
                  }}
                >
                  <span className={styles.chatTitle}>{conversation.title}</span>
                  <span className={styles.chatMeta}>{new Date(conversation.updatedAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.chatPane}>
          <div className={styles.chatHeader}>
            <h2>{activeConversation?.title ?? 'New chat'}</h2>
            <Button variant="ghost" onClick={clearActiveChat} disabled={!activeConversation || activeConversation.messages.length === 0 || loading}>
              Clear chat
            </Button>
          </div>

          <div className={styles.messages} ref={messagesScrollRef}>
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className={styles.emptyState}>
                Ask questions about studies, cohorts, node health, quality metrics, and trial matching. AI responses are scoped to your organization dataset.
              </div>
            ) : null}

            {activeConversation?.messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className={`${styles.message} ${styles.userMessage}`}>
                  {message.content}
                </div>
              ) : (
                <article key={message.id} className={`${styles.message} ${styles.assistantMessage}`}>
                  <p className={styles.answer}>{message.content.answer}</p>

                  {message.content.keyFindings.length > 0 ? (
                    <ul className={styles.findings}>
                      {message.content.keyFindings.map((finding, index) => (
                        <li key={`${message.id}-finding-${index}`}>{finding}</li>
                      ))}
                    </ul>
                  ) : null}

                  {message.content.recommendedDecision ? (
                    <div className={styles.decisionCard}>
                      <strong>Recommended decision:</strong> {message.content.recommendedDecision.action}
                      <p>Expected impact: {message.content.recommendedDecision.expectedImpact}</p>
                    </div>
                  ) : null}

                  {message.context.length > 0 ? (
                    <div className={styles.refs}>
                      {message.context.map((item) => (
                        <span key={`${message.id}-${item.referenceId}`} className={styles.refChip}>
                          {item.referenceId}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {loading ? <div className={styles.loading}>AI is analyzing your workspace context...</div> : null}
            {error ? <div className={styles.error}>{error}</div> : null}
          </div>

          <div className={styles.composer}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className={styles.input}
              rows={3}
              placeholder="Ask about cohort performance, trial feasibility, quality drift, or compliance signals..."
            />
            <div className={styles.composerActions}>
              <span className={styles.hint}>Enter to send. Shift+Enter for new line.</span>
              <Button
                onClick={() => void submitQuestion(question)}
                disabled={loading || question.trim().length < 4 || !activeConversation}
              >
                {loading ? 'Thinking...' : 'Send'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
