import { useState } from "react";
import { getJson } from "./api.js";

const EMPTY_DATA = {
  agenda: null,
  tasks: null,
  reminders: null,
  conversations: null,
  messages: null,
};

export function useReadPanel({ token, onUnauthorized }) {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function run(view, path, merge) {
    if (!token) return;
    setLoading(view);
    setError("");
    try {
      const payload = await getJson(path, token);
      setData((current) => ({ ...current, ...merge(payload) }));
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.status === 403) {
        onUnauthorized?.();
        return;
      }
      setError(requestError?.message || "No pude cargar la información.");
    } finally {
      setLoading("");
    }
  }

  function loadAgenda({ latitude, longitude } = {}) {
    const params = new URLSearchParams();
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      params.set("latitude", String(latitude));
      params.set("longitude", String(longitude));
    }
    const query = params.toString();
    return run("agenda", `/api/agenda${query ? `?${query}` : ""}`, (payload) => ({ agenda: payload }));
  }

  function loadTasks(scope = "open") {
    const status = scope === "all" ? "all" : "open";
    return run("tasks", `/api/tasks?status=${status}`, (payload) => ({ tasks: payload }));
  }

  function loadReminders(hours = 24) {
    return run("reminders", `/api/reminders?hours=${hours}`, (payload) => ({ reminders: payload }));
  }

  function loadConversations() {
    return run("history", "/api/conversations", (payload) => ({ conversations: payload }));
  }

  function loadMessages(conversationId) {
    return run(
      "messages",
      `/api/conversations/messages?conversation_id=${encodeURIComponent(conversationId)}`,
      (payload) => ({ messages: payload }),
    );
  }

  function reset() {
    setData(EMPTY_DATA);
    setLoading("");
    setError("");
  }

  return {
    ...data,
    loading,
    error,
    loadAgenda,
    loadTasks,
    loadReminders,
    loadConversations,
    loadMessages,
    reset,
  };
}
