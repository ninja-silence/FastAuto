import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Send, Bot, User, Plus, Trash2, MessageSquare,
  ChevronLeft, Loader2, Car, Zap, AlertCircle, Eye, ChevronDown, Square,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  streamChat, getConversations, getConversation, deleteConversation,
  type AiMessage, type AiConversation,
} from '../api/ai';
import { carsApi, type Car as CarType } from '../api/cars';
import { CarImagePlaceholder } from '../components/CarImagePlaceholder';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { useLanguage } from '../i18n/LanguageContext';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isToolCall?: boolean;
  toolName?: string;
  carPreviews?: CarType[];
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// ── Module-level conversation cache ────────────────────────────────────────
// Stores full LocalMessage arrays (including CarType objects) in a plain Map.
// Survives React component unmount/remount within the same browser tab,
// so back-navigation instantly restores the exact conversation state.
const _convCache = new Map<string, LocalMessage[]>();

async function fetchCarsByMentions(content: string): Promise<CarType[]> {
  UUID_RE.lastIndex = 0;
  const uuids: string[] = [];
  let u: RegExpExecArray | null;
  while ((u = UUID_RE.exec(content)) !== null) uuids.push(u[0]);

  if (uuids.length > 0) {
    const results = await Promise.allSettled(
      [...new Set(uuids)].map(id => carsApi.get(id).catch(() => null))
    );
    const cars: CarType[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && !seen.has(r.value.id)) {
        seen.add(r.value.id);
        cars.push(r.value);
      }
    }
    if (cars.length > 0) return cars;
  }

  return [];
}

function formatCarPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(price);
}

function CarPreviewCard({ car }: { car: CarType }) {
  const img = car.images.find(i => i.is_primary) || car.images[0];
  const src = img?.url || img?.thumbnail_url || '';
  return (
    <Link
      to={`/car/${car.id}`}
      className="group flex gap-3 bg-background border border-border rounded-xl p-2.5
        transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:shadow-primary/20
        hover:border-foreground/30 overflow-hidden"
    >
      <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
        {src ? (
          <ImageWithFallback
            src={src}
            alt={`${car.brand} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <CarImagePlaceholder />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="font-semibold text-sm text-foreground truncate">
          {car.brand} {car.model}
        </p>
        <p className="text-xs text-muted-foreground">
          {car.year}{car.mileage > 0 ? ` • ${car.mileage.toLocaleString('ru-RU')} км` : ''}
        </p>
        <p className="text-sm font-semibold text-foreground mt-0.5">
          {formatCarPrice(car.price)}
        </p>
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center pr-1">
        <Eye className="w-4 h-4 text-primary" />
      </div>
    </Link>
  );
}

function AiMarkdown({ content }: { content: string }) {
  const normalized = content
    .replace(/_/g, ' ')
    // Скрываем строки с UUID (ID объявления не нужен пользователю)
    .replace(/^[^\n]*\bID\b[^\n]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^\n]*\n?/gim, '')
    // Скрываем строки где город/город содержит только цифры (city_id вместо названия)
    .replace(/^[^\n]*[Гг]ород[^\n]*:\s*\d{6,}[^\n]*\n?/gm, '');
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold text-sm mb-0.5">{children}</p>,
        ul: ({ children }) => <ul className="my-1.5 space-y-0.5 pl-1">{children}</ul>,
        li: ({ children }) => (
          <li className="flex gap-2">
            <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            <span>{children}</span>
          </li>
        ),
        ol: ({ children }) => <ol className="my-1.5 space-y-0.5 pl-1 list-decimal list-inside">{children}</ol>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[0.8em] font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 p-3 bg-black/10 dark:bg-white/10 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
            {children}
          </pre>
        ),
        hr: () => <hr className="my-2 border-current opacity-20" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-current/20">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-current/10 last:border-0">{children}</tr>,
        th: ({ children }) => (
          <th className="text-left font-semibold px-3 py-1.5 text-xs opacity-70 uppercase tracking-wide">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
}

function MessageBubble({ msg }: { msg: LocalMessage }) {
  const { T } = useLanguage();
  const isUser = msg.role === 'user';

  if (msg.isToolCall) {
    return (
      <div className="flex justify-center my-1">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{T.ai.searching}{msg.toolName ? `: ${msg.toolName}` : ''}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap'
            : 'bg-card border border-border text-foreground rounded-tl-sm'
        }`}>
          {isUser ? (
            msg.content || (msg.isStreaming
              ? <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm" />
              : '...')
          ) : (
            msg.content
              ? <>
                  <AiMarkdown content={msg.content} />
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm ml-0.5 align-middle" />
                  )}
                </>
              : msg.isStreaming
                ? <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm" />
                : '...'
          )}
        </div>
        {!isUser && msg.carPreviews && msg.carPreviews.length > 0 && (
          <div className="w-full flex flex-col gap-2 mt-1">
            {msg.carPreviews.map(car => (
              <CarPreviewCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const { T } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-16 h-16 bg-foreground rounded-2xl flex items-center justify-center mb-6 rotate-3">
        <Car className="w-8 h-8 text-background" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">{T.ai.title}</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">{T.ai.subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {T.ai.suggestions.map((s: string) => (
          <button key={s} onClick={() => onSuggestion(s)}
            className="text-left px-4 py-3 bg-card border border-border rounded-xl text-sm hover:border-foreground hover:shadow-sm transition-all duration-200 group">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-muted-foreground group-hover:text-foreground mt-0.5 flex-shrink-0 transition-colors" />
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">{s}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Sidebar({
  conversations, activeId, onSelect, onNew, onDelete, collapsed,
}: {
  conversations: AiConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { T } = useLanguage();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmId(id);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmId) onDelete(confirmId);
    setConfirmId(null);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmId(null);
  };

  return (
    <aside className={`flex flex-col bg-card border-r border-border transition-all duration-300 ${
      collapsed ? 'w-0 overflow-hidden' : 'w-64'
    }`}>
      <div className="p-4 border-b border-border flex-shrink-0">
        <button onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          {T.ai.newChat}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">{T.ai.noChats}</p>
        )}
        {conversations.map(conv => {
          const isActive = activeId === conv.id;
          const isConfirming = confirmId === conv.id;

          return (
            <div key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                isActive ? 'bg-foreground text-background' : 'hover:bg-secondary text-foreground'
              }`}
              onClick={() => !isConfirming && onSelect(conv.id)}>
              <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60 shrink-0" />

              {isConfirming ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-destructive font-medium truncate flex-1">Удалить?</span>
                  <button
                    onClick={handleConfirm}
                    className="text-xs px-1.5 py-0.5 bg-destructive text-white rounded hover:opacity-90 transition-opacity shrink-0">
                    Да
                  </button>
                  <button
                    onClick={handleCancel}
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                      isActive ? 'bg-white/20 hover:bg-white/30' : 'bg-secondary hover:bg-secondary/80'
                    }`}>
                    Нет
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm truncate flex-1">{conv.title ?? T.ai.newDialog}</span>
                  <button
                    onClick={e => handleDeleteClick(e, conv.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                      isActive ? 'hover:bg-white/20' : 'hover:bg-destructive/10 hover:text-destructive'
                    }`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function AiPage() {
  const { user, loading: authLoading } = useAuth();
  const { T } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hadCarSearchRef = useRef<boolean>(false);
  const collectedListingIdsRef = useRef<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  // messagesContainerRef is stable, but we want this to re-run if the node changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesContainerRef.current]);

  // Sync active conversation ID to URL so back-button navigation restores it
  useEffect(() => {
    if (activeConversationId) {
      setSearchParams({ c: activeConversationId }, { replace: true });
    }
  }, [activeConversationId, setSearchParams]);

  const loadConversation = useCallback(async (id: string) => {
    // Fast path: module-level cache (survives navigation within the tab)
    const cached = _convCache.get(id);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setActiveConversationId(id);
      return;
    }

    // Slow path: load from server (first open, or after tab refresh)
    setLoadingConversation(true);
    try {
      const conv = await getConversation(id);
      const withPreviews = await Promise.all(
        conv.messages.map(async (m: AiMessage) => {
          const base: LocalMessage = { id: m.id, role: m.role, content: m.content };
          if (m.role !== 'assistant') return base;

          // Use listing_ids stored in DB (works after logout/refresh)
          const ids = m.listing_ids ?? [];
          if (ids.length > 0) {
            const results = await Promise.allSettled(ids.map(lid => carsApi.get(lid).catch(() => null)));
            const carPreviews: CarType[] = [];
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) carPreviews.push(r.value);
            }
            if (carPreviews.length > 0) return { ...base, carPreviews };
          }

          // Fallback: scan content for UUIDs (legacy messages without listing_ids)
          const carPreviews = await fetchCarsByMentions(m.content);
          return carPreviews.length > 0 ? { ...base, carPreviews } : base;
        })
      );
      setMessages(withPreviews);
      setActiveConversationId(id);
      _convCache.set(id, withPreviews);
    } catch {
      toast.error(T.ai.loadError);
    } finally {
      setLoadingConversation(false);
    }
  }, [T.ai.loadError]);

  // On mount (after auth): load conversation from URL param if present
  useEffect(() => {
    if (!user) return;
    getConversations().then(data => setConversations(data.data)).catch(() => {});
    const convId = searchParams.get('c');
    if (convId) loadConversation(convId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startNewConversation = useCallback(() => {
    setMessages([]); setActiveConversationId(null); setInput('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) startNewConversation();
      toast.success(T.ai.deleteSuccess);
    } catch {
      toast.error(T.ai.deleteError);
    }
  }, [activeConversationId, startNewConversation, T.ai.deleteSuccess, T.ai.deleteError]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: LocalMessage = { id: `user-${Date.now()}`, role: 'user', content: text.trim() };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: LocalMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    hadCarSearchRef.current = false;
    collectedListingIdsRef.current = [];

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await streamChat(
      text.trim(), activeConversationId,
      (chunk) => {
        if (controller.signal.aborted) return;
        if (chunk.type === 'tool_call') {
          hadCarSearchRef.current = true;
          if (chunk.listing_ids && chunk.listing_ids.length > 0) {
            collectedListingIdsRef.current = [
              ...new Set([...collectedListingIdsRef.current, ...chunk.listing_ids]),
            ];
          }
          setMessages(prev => {
            const withoutOldTool = prev.filter(m => !m.isToolCall);
            return [...withoutOldTool, { id: `tool-${Date.now()}`, role: 'assistant', content: '', isToolCall: true, toolName: chunk.name }];
          });
        } else if (chunk.type === 'token' && chunk.content) {
          setMessages(prev => prev.filter(m => !m.isToolCall).map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk.content } : m
          ));
        }
      },
      (convId) => {
        setIsStreaming(false);

        // Capture refs OUTSIDE of state updater (no side-effects inside updater)
        hadCarSearchRef.current = false;
        const directIds = [...collectedListingIdsRef.current];
        collectedListingIdsRef.current = [];

        const cid = convId || activeConversationId;

        // 1. Update messages: remove tool-call placeholders, mark as done
        setMessages(prev => {
          const updated = prev
            .filter(m => !m.isToolCall)
            .map(m => m.id === assistantId ? { ...m, isStreaming: false } : m);
          // Save to cache immediately (text is ready, previews come later)
          if (cid) _convCache.set(cid, updated);
          return updated;
        });

        // 2. Update conversation ID / sidebar (for new conversations)
        if (convId && !activeConversationId) {
          setActiveConversationId(convId);
          getConversations().then(data => setConversations(data.data)).catch(() => {});
        }

        // 3. Load car previews asynchronously (fully outside state updater)
        const loadPreviews = async () => {
          let carPreviews: CarType[] = [];

          if (directIds.length > 0) {
            const results = await Promise.allSettled(
              directIds.map(id => carsApi.get(id).catch(() => null))
            );
            const seen = new Set<string>();
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value && !seen.has(r.value.id)) {
                seen.add(r.value.id);
                carPreviews.push(r.value);
              }
            }
          }

          // Fallback: scan message text for UUID mentions
          if (carPreviews.length === 0) {
            // Read content from cache (component may have unmounted)
            const cached = cid ? _convCache.get(cid) : null;
            const msg = cached?.find(m => m.id === assistantId);
            if (msg?.content) {
              carPreviews = await fetchCarsByMentions(msg.content);
            }
          }

          if (carPreviews.length > 0) {
            // Update React state (no-op if unmounted, but cache update always runs)
            setMessages(prev => {
              const updated = prev.map(m =>
                m.id === assistantId ? { ...m, carPreviews } : m
              );
              if (cid) _convCache.set(cid, updated);
              return updated;
            });
            // Update cache even if component unmounted
            if (cid) {
              const cached = _convCache.get(cid);
              if (cached) {
                _convCache.set(cid, cached.map(m =>
                  m.id === assistantId ? { ...m, carPreviews } : m
                ));
              }
            }
          }
        };
        loadPreviews();
      },
      (error) => {
        setIsStreaming(false);
        setMessages(prev => prev.filter(m => !m.isToolCall).map(m =>
          m.id === assistantId ? { ...m, content: error, isStreaming: false } : m
        ));
      },
      controller.signal,
    );
  }, [isStreaming, activeConversationId]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages(prev => prev.filter(m => !m.isToolCall).map(m =>
      m.isStreaming ? { ...m, isStreaming: false } : m
    ));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-foreground rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Bot className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">{T.ai.title}</h1>
          <p className="text-muted-foreground mb-6">{T.ai.authDesc}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/profile" className="px-6 py-3 bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity font-medium">{T.ai.signIn}</Link>
            <Link to="/catalog" className="px-6 py-3 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 transition-colors border border-border">{T.ai.toCatalog}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={startNewConversation}
        onDelete={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(p => !p)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Topbar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0">
          <button onClick={() => setSidebarCollapsed(p => !p)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground">
            <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-background" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{T.ai.title}</p>
              <p className="text-xs text-muted-foreground">{T.ai.carSelection}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">{T.ai.online}</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
          {loadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onSuggestion={s => { setInput(s); sendMessage(s); }} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            </div>
          )}
        </div>

        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-28 right-6 z-20 w-9 h-9 flex items-center justify-center
              bg-foreground text-background rounded-full shadow-lg
              hover:opacity-90 transition-all duration-200 hover:scale-110"
            aria-label="Прокрутить вниз"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        {/* Notice */}
        <div className="px-4 pb-1 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{T.ai.disclaimer}</span>
          </div>
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm focus-within:border-foreground transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={T.ai.placeholder}
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground max-h-40 leading-relaxed"
                style={{ height: 'auto' }}
              />
              {isStreaming ? (
                <button
                  onClick={cancelStream}
                  className="flex-shrink-0 w-9 h-9 bg-foreground text-background rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity relative"
                  aria-label="Отменить запрос"
                >
                  <Loader2 className="w-full h-full p-1.5 animate-spin absolute inset-0" />
                  <Square className="w-3 h-3 relative z-10 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="flex-shrink-0 w-9 h-9 bg-foreground text-background rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {T.ai.enterSend}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
