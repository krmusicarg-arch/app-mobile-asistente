import { useCallback, useEffect, useState } from "react";
import { getFamilyMessages, markFamilyMessageRead, sendFamilyMessage } from "./api.js";

const PAGE_SIZE = 50;

export function useFamilyMessages({ token, onUnauthorized }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async ({ append = false, quiet = false } = {}) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    if (!quiet) setError("");
    try {
      const offset = append ? messages.length : 0;
      const payload = await getFamilyMessages(token, { offset, limit: PAGE_SIZE });
      setMessages((current) => {
        const next = append ? [...current, ...(payload.messages || [])] : (payload.messages || []);
        const unique = new Map(next.map((message) => [message.id, message]));
        return [...unique.values()];
      });
      setMembers(payload.members || []);
      setUnreadCount(Number(payload.unreadCount) || 0);
      setHasMore(Boolean(payload.hasMore));
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.status === 403) onUnauthorized?.();
      else if (!quiet) setError(requestError?.message || "No pude cargar los mensajes familiares.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token, messages.length, onUnauthorized]);

  const send = useCallback(async ({ content, recipientId = null, requestId: suppliedRequestId }) => {
    const requestId = suppliedRequestId || globalThis.crypto?.randomUUID?.();
    if (!requestId) throw new Error("Este navegador no puede generar una clave segura para el envío.");
    const result = await sendFamilyMessage(token, { content, recipientId, requestId });
    await load({ quiet: true });
    return result;
  }, [token, load]);

  const markRead = useCallback(async (messageId) => {
    await markFamilyMessageRead(token, messageId);
    await load({ quiet: true });
  }, [token, load]);

  useEffect(() => {
    if (!token) {
      setMessages([]);
      setMembers([]);
      setUnreadCount(0);
      return undefined;
    }
    void load({ quiet: true });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ quiet: true });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [token]);

  return { messages, members, unreadCount, loading, error, hasMore, load, send, markRead };
}
