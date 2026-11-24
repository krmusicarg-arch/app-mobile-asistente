const TASK_STATUS = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value, timezone) {
  const date = toDate(value);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString("es-AR");
  }
}

function formatTime(value, timezone) {
  const date = toDate(value);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleTimeString("es-AR");
  }
}

function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°` : "—";
}

function RefreshButton({ onClick, busy }) {
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={onClick}
      disabled={busy}
      aria-label="Actualizar"
      title="Actualizar"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </button>
  );
}

function PanelHeader({ title, subtitle, onRefresh, busy }) {
  return (
    <div className="panel-head">
      <div className="panel-head-copy">
        <p className="eyebrow">PANEL FAMILIAR</p>
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
      {onRefresh && <RefreshButton onClick={onRefresh} busy={busy} />}
    </div>
  );
}

function Feedback({ loading, error, empty, hasData }) {
  if (error) return <p className="panel-error" role="alert">{error}</p>;
  if (loading && !hasData) return <p className="panel-empty">Cargando…</p>;
  if (!loading && !hasData && empty) return <p className="panel-empty">{empty}</p>;
  return null;
}

function Section({ title, count, items, empty, render }) {
  return (
    <section className="panel-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="section-count">{count}</span>
      </div>
      {items.length === 0
        ? <p className="section-empty">{empty}</p>
        : <ul className="row-list">{items.map(render)}</ul>}
    </section>
  );
}

function TaskRow({ task, timezone }) {
  const due = task.dueAt ? formatDateTime(task.dueAt, timezone) : "";
  const meta = [
    task.assignedToName ? `Asignada a ${task.assignedToName}` : "",
    due ? `Vence ${due}` : "",
  ].filter(Boolean).join(" · ");
  return (
    <li className="row">
      <div className="row-main">
        <span className="row-title">{task.description}</span>
        {meta && <span className="row-meta">{meta}</span>}
      </div>
      <span className={`status-chip status-${task.status}`}>
        {TASK_STATUS[task.status] || task.status}
      </span>
    </li>
  );
}

function ReminderRow({ reminder, timezone }) {
  const when = formatDateTime(reminder.scheduledAt, timezone);
  const meta = [when, reminder.description].filter(Boolean).join(" · ");
  return (
    <li className="row">
      <div className="row-main">
        <span className="row-title">{reminder.title}</span>
        {meta && <span className="row-meta">{meta}</span>}
      </div>
    </li>
  );
}

function AgendaWeather({ weather }) {
  const current = weather.current || {};
  const today = weather.today || {};
  return (
    <div className="agenda-weather">
      <span className="agenda-weather-icon" aria-hidden="true">{current.icon || "🌡️"}</span>
      <div className="agenda-weather-copy">
        <p className="agenda-weather-temp">{formatTemperature(current.temperature)}</p>
        <p className="agenda-weather-desc">{current.description || "Clima actual"}</p>
      </div>
      <div className="agenda-weather-range">
        <span>Máx {formatTemperature(today.temperatureMax)}</span>
        <span>Mín {formatTemperature(today.temperatureMin)}</span>
        {Number.isFinite(today.precipitationProbability) && (
          <span>☂ {Math.round(today.precipitationProbability)}%</span>
        )}
      </div>
    </div>
  );
}

export function AgendaView({ agenda, loading, error, onRefresh, onWeather }) {
  return (
    <div className="panel">
      <PanelHeader
        title="Mi día"
        subtitle={agenda
          ? `Resumen de las ${formatTime(agenda.generatedAt, agenda.timezone)}`
          : "Tus tareas, recordatorios y cumpleaños"}
        onRefresh={onRefresh}
        busy={loading === "agenda"}
      />
      <Feedback loading={loading === "agenda"} error={error} empty="Todavía no hay información para mostrar." hasData={Boolean(agenda)} />
      {agenda && (
        <>
          {agenda.weather
            ? <AgendaWeather weather={agenda.weather} />
            : (
              <button type="button" className="weather-cta" onClick={onWeather}>
                <span aria-hidden="true">🌤️</span> Ver el clima de hoy
              </button>
            )}
          <Section
            title="Tareas abiertas"
            count={agenda.tasks.length}
            items={agenda.tasks}
            empty="No hay tareas abiertas."
            render={(task) => <TaskRow key={task.id} task={task} timezone={agenda.timezone} />}
          />
          <Section
            title="Recordatorios"
            count={agenda.reminders.length}
            items={agenda.reminders}
            empty="No hay recordatorios próximos."
            render={(reminder) => <ReminderRow key={reminder.id} reminder={reminder} timezone={agenda.timezone} />}
          />
          <Section
            title="Cumpleaños"
            count={agenda.birthdays.length}
            items={agenda.birthdays}
            empty="No hay cumpleaños guardados."
            render={(birthday) => (
              <li className="row" key={birthday.id}>
                <div className="row-main">
                  <span className="row-title">{birthday.content}</span>
                  {birthday.subjectName && <span className="row-meta">{birthday.subjectName}</span>}
                </div>
              </li>
            )}
          />
        </>
      )}
    </div>
  );
}

export function TasksView({ tasks, scope, onScopeChange, loading, error, onRefresh }) {
  const items = tasks?.tasks || [];
  return (
    <div className="panel">
      <PanelHeader
        title="Tareas"
        subtitle="Lo que quedó pendiente en familia"
        onRefresh={onRefresh}
        busy={loading === "tasks"}
      />
      <div className="chip-row" role="group" aria-label="Filtro de tareas">
        <button
          type="button"
          className={`chip ${scope === "open" ? "is-active" : ""}`}
          onClick={() => onScopeChange("open")}
        >
          Abiertas
        </button>
        <button
          type="button"
          className={`chip ${scope === "all" ? "is-active" : ""}`}
          onClick={() => onScopeChange("all")}
        >
          Todas
        </button>
      </div>
      <Feedback loading={loading === "tasks"} error={error} empty="No hay tareas para mostrar." hasData={Boolean(tasks)} />
      {tasks && items.length > 0 && (
        <ul className="row-list">
          {items.map((task) => <TaskRow key={task.id} task={task} />)}
        </ul>
      )}
    </div>
  );
}

export function RemindersView({ reminders, hours, onHoursChange, loading, error, onRefresh }) {
  const items = reminders?.reminders || [];
  return (
    <div className="panel">
      <PanelHeader
        title="Recordatorios"
        subtitle="Avisos que Robertito va a recordar"
        onRefresh={onRefresh}
        busy={loading === "reminders"}
      />
      <div className="chip-row" role="group" aria-label="Ventana de recordatorios">
        {[[24, "24 h"], [48, "48 h"], [168, "7 días"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${hours === value ? "is-active" : ""}`}
            onClick={() => onHoursChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <Feedback loading={loading === "reminders"} error={error} empty="No hay recordatorios en este período." hasData={Boolean(reminders)} />
      {reminders && items.length > 0 && (
        <ul className="row-list">
          {items.map((reminder) => <ReminderRow key={reminder.id} reminder={reminder} />)}
        </ul>
      )}
    </div>
  );
}

export function HistoryView({
  conversations,
  messages,
  selectedId,
  onSelect,
  onBack,
  loading,
  error,
  onRefresh,
}) {
  const items = conversations?.conversations || [];
  const bubbles = messages?.messages || [];
  return (
    <div className="panel">
      <PanelHeader
        title={selectedId ? "Conversación" : "Historial"}
        subtitle={selectedId ? "Mensajes guardados" : "Tus últimas charlas con Robertito"}
        onRefresh={selectedId ? undefined : onRefresh}
        busy={loading === "history"}
      />
      {selectedId ? (
        <>
          <button type="button" className="text-action back-action" onClick={onBack}>
            ← Volver al historial
          </button>
          <Feedback loading={loading === "messages"} error={error} empty="Esta conversación no tiene mensajes." hasData={Boolean(messages)} />
          {messages && bubbles.length > 0 && (
            <ol className="message-list">
              {bubbles.map((message, index) => (
                <li
                  key={`${message.role}-${index}`}
                  className={`message-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}
                >
                  <p>{message.content}</p>
                  <span>{formatDateTime(message.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          <Feedback loading={loading === "history"} error={error} empty="Todavía no hay conversaciones guardadas." hasData={Boolean(conversations)} />
          {conversations && items.length > 0 && (
            <ul className="row-list">
              {items.map((conversation) => (
                <li className="row" key={conversation.id}>
                  <button type="button" className="row-button" onClick={() => onSelect(conversation.id)}>
                    <span className="row-main">
                      <span className="row-title">
                        {conversation.channel === "pwa" ? "App móvil" : "Dispositivo"}
                      </span>
                      <span className="row-meta">
                        {formatDateTime(conversation.startedAt)}
                        {conversation.endedAt ? "" : " · abierta"}
                      </span>
                    </span>
                    <span className="row-chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
