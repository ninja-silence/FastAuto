const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  listing_ids?: string[];
}

export interface AiConversation {
  id: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

export interface AiConversationsPublic {
  data: AiConversation[];
  count: number;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error' | 'tool_call';
  content?: string;
  message?: string;
  conversation_id?: string;
  name?: string;
  listing_ids?: string[];
}

export async function streamChat(
  message: string,
  conversationId: string | null,
  onChunk: (chunk: StreamChunk) => void,
  onDone: (conversationId: string | null) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) {
    onError('Необходима авторизация');
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, conversation_id: conversationId }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    onError('Ошибка запроса');
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
    if (res.status === 429) {
      onError('Превышен лимит запросов. Подождите минуту.');
    } else {
      onError(err.detail ?? 'Ошибка запроса');
    }
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onError('Нет потока данных'); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6));
          if (chunk.type === 'done') {
            onDone(chunk.conversation_id ?? null);
          } else if (chunk.type === 'error') {
            onError(chunk.message ?? 'Ошибка');
          } else {
            onChunk(chunk);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') onError('Ошибка чтения потока');
  } finally {
    reader.releaseLock();
  }
}

export async function getConversations(): Promise<AiConversationsPublic> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${BASE_URL}/ai/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return res.json();
}

export async function getConversation(id: string): Promise<{ id: string; title: string | null; messages: AiMessage[] }> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${BASE_URL}/ai/conversations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  await fetch(`${BASE_URL}/ai/conversations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}