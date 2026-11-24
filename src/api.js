const API_BASE_URL = (import.meta.env.VITE_ASSISTANT_BACKEND_URL || "").replace(/\/$/, "");

const ERROR_MESSAGES = {
  invalid_passcode: "El código familiar no es correcto.",
  invalid_speaker: "Ese integrante ya no está disponible.",
  speaker_mismatch: "La sesión no corresponde al integrante seleccionado.",
  unauthorized: "La sesión venció. Ingresá nuevamente el código familiar.",
  invalid_conversation: "No pude abrir esa conversación.",
  invalid_recipient: "Ese destinatario no está disponible en esta familia.",
  invalid_message: "El mensaje está vacío o supera el largo permitido.",
  idempotency_conflict: "Ese envío ya se usó para otro mensaje. Volvé a intentarlo.",
  family_storage_error: "No pude cargar la información en este momento.",
  speaker_required: "Falta indicar el integrante de la familia.",
};

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
}

function requestError(response, payload) {
  const error = new Error(
    payload?.answer || ERROR_MESSAGES[payload?.status] || "No pude completar la consulta.",
  );
  error.status = response.status;
  error.code = payload?.status;
  return error;
}

export async function postJson(path, body, token, signal) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) throw requestError(response, payload);
  return payload;
}

export async function getJson(path, token, signal) {
  const response = await fetch(apiUrl(path), {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) throw requestError(response, payload);
  return payload;
}

export function getFamilyMessages(token, { offset = 0, limit = 50 } = {}, signal) {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  return getJson(`/api/family-messages?${query}`, token, signal);
}

export function sendFamilyMessage(token, { content, recipientId = null, requestId }) {
  return postJson("/api/family-messages", {
    content,
    recipient_id: recipientId,
    request_id: requestId,
  }, token);
}

export function markFamilyMessageRead(token, messageId) {
  return postJson("/api/family-messages", { action: "read", message_id: messageId }, token);
}
