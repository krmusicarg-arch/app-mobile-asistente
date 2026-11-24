import { useRef, useState } from "react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function FamilyMessagesView({
  messages,
  members,
  member,
  unreadCount,
  loading,
  error,
  hasMore,
  onRefresh,
  onLoadMore,
  onSend,
  onRead,
}) {
  const [content, setContent] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [readError, setReadError] = useState("");
  const pendingRequest = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    setSendError("");
    const signature = `${recipientId || "all"}|${content.trim()}`;
    if (pendingRequest.current?.signature !== signature) {
      pendingRequest.current = {
        signature,
        id: globalThis.crypto?.randomUUID?.(),
      };
    }
    try {
      if (!pendingRequest.current.id) throw new Error("Este navegador no puede generar una clave segura para el envío.");
      await onSend({ content: content.trim(), recipientId: recipientId || null, requestId: pendingRequest.current.id });
      pendingRequest.current = null;
      setContent("");
    } catch (requestError) {
      setSendError(requestError?.message || "No pude enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="panel family-messages-panel">
      <header className="panel-head">
        <div className="panel-head-copy">
          <p className="eyebrow">FAMILIA</p>
          <h1 className="panel-title">Mensajes</h1>
          <p className="panel-subtitle">Mensajes compartidos con todos. {unreadCount ? `${unreadCount} sin leer.` : "Estás al día."}</p>
        </div>
        <button className="icon-btn" onClick={onRefresh} type="button" aria-label="Actualizar mensajes" title="Actualizar">
          <span aria-hidden="true">↻</span>
        </button>
      </header>

      <form className="family-message-compose" onSubmit={submit}>
        <label htmlFor="family-message-recipient">Enviar a</label>
        <select id="family-message-recipient" value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
          <option value="">Toda la familia</option>
          {members.filter((item) => item.id !== member?.id).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <label htmlFor="family-message-content">Mensaje</label>
        <textarea
          id="family-message-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escribí un mensaje para tu familia…"
          maxLength={1000}
          rows={3}
        />
        <div className="family-compose-actions">
          <span>{content.length}/1000</span>
          <button className="primary-action" type="submit" disabled={!content.trim() || sending}>
            {sending ? "Enviando…" : "Enviar mensaje"}
          </button>
        </div>
        {sendError && <p className="notice" role="alert">{sendError}</p>}
      </form>

      <div className="family-message-history-head">
        <h2>Historial familiar</h2>
        <span>{messages.length} mensajes</span>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {loading && !messages.length && <p className="empty-state">Cargando mensajes…</p>}
      {!loading && !messages.length && <p className="empty-state">Todavía no hay mensajes familiares.</p>}
      <ul className="family-message-list">
        {messages.map((message) => {
          const mine = message.senderId === member?.id;
          const ownReceipt = message.readBy?.find((read) => read.memberId === member?.id);
          return (
            <li key={message.id} className={`family-message-card ${ownReceipt && !ownReceipt.readAt ? "is-unread" : ""}`}>
              <button type="button" className="family-message-open" onClick={() => {
                if (!mine && !ownReceipt?.readAt) {
                  setReadError("");
                  void onRead(message.id).catch((requestError) => setReadError(requestError?.message || "No pude marcar el mensaje como leído."));
                }
              }} aria-label={`Abrir mensaje de ${message.senderName}`}>
                <span className="family-message-avatar" aria-hidden="true">{message.senderName?.slice(0, 1)?.toLocaleUpperCase("es-AR") || "?"}</span>
                <span className="family-message-main">
                  <span className="family-message-topline">
                    <strong>{mine ? "Vos" : message.senderName}</strong>
                    <time>{formatDate(message.createdAt)}</time>
                  </span>
                  <span className="family-message-destination">
                    {message.recipientName ? `Para ${message.recipientName}` : "Para toda la familia"}
                    {message.isPriorityForMe && <b>Para vos</b>}
                    {ownReceipt && !ownReceipt.readAt && <i>Nuevo</i>}
                  </span>
                  <span className="family-message-content">{message.content}</span>
                  <span className="family-message-receipts">
                    {mine
                      ? `${message.readCount || 0} de ${message.readBy?.length || 0} leyeron`
                      : ownReceipt?.readAt ? "Leído" : "Tocá para marcar como leído"}
                    {mine && message.readBy?.length > 0 && (
                      <span className="family-message-reader-names">
                        {message.readBy.filter((read) => read.readAt).map((read) => read.name).join(", ") || "Pendiente"}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {readError && <p className="notice" role="alert">{readError}</p>}
      {hasMore && <button className="text-action family-load-more" type="button" onClick={onLoadMore}>{loading ? "Cargando…" : "Ver mensajes anteriores"}</button>}
      <p className="family-message-live-note"><span className="privacy-dot" aria-hidden="true" />Actualización automática cada 30 segundos</p>
    </article>
  );
}
