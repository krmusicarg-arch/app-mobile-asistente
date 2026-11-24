import { useEffect, useRef, useState } from "react";
import { usePwaInstall } from "./usePwaInstall.js";
import { InstallModal } from "./InstallModal.jsx";
import { MusicActionHandler } from "./MusicActionHandler.jsx";
import { WeatherCard } from "./WeatherCard.jsx";
import { splitSpeechText } from "./speechText.js";
import { postJson } from "./api.js";
import { useReadPanel } from "./useReadPanel.js";
import { AgendaView, TasksView, RemindersView, HistoryView } from "./InsightsViews.jsx";

const SESSION_STORAGE_KEY = "family-assistant-session";
const MEMBER_STORAGE_KEY = "family-assistant-member";
const CONVERSATION_STORAGE_KEY = "family-assistant-conversation";
const REQUEST_TIMEOUT_MS = 55_000;

const FRIENDLY_ERRORS = {
  "not-allowed": "Necesito permiso para usar el micrófono.",
  "service-not-allowed": "El reconocimiento de voz no está permitido en este navegador.",
  "audio-capture": "No pude acceder al micrófono.",
  network: "No pude conectarme al servicio de voz.",
  "no-speech": "No llegué a escucharte. Tocá para intentar otra vez.",
};

function storedJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function normalizeQuestion(text) {
  return text.toLocaleLowerCase("es-AR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function isWeatherQuestion(text) {
  const normalized = normalizeQuestion(text);
  return /\b(clima|meteorolog|pronostico|temperatura|grados|llover|lluvia|llueve|llovizna|nevar|nieve|humedad|viento)\b/.test(normalized)
    || /\bque tiempo\b/.test(normalized)
    || /\bcomo (?:esta|va a estar|estara)(?: el)? tiempo\b/.test(normalized)
    || /\bhace (?:el )?tiempo\b/.test(normalized)
    || /\bcomo va a estar\b/.test(normalized)
    || /\b(?:comparame|compara|comparar)\b/.test(normalized)
    || /\bdonde hace mas calor\b/.test(normalized)
    || /^\s*[¿¡]?y\s+en\b/.test(normalized);
}

function hasExplicitWeatherLocation(text) {
  const normalized = normalizeQuestion(text);
  if (/\b(?:donde estoy|donde me encuentro|mi ubicacion|mi ciudad|aqui|aca|en casa)\b/.test(normalized)) return false;
  const match = normalized.match(/\b(?:en|para|de)\s+(?:(?:la|el|los|las)\s+)?(.+)$/);
  if (!match) return false;
  const place = match[1]
    .replace(/\b(?:hoy|manana|pasado manana|esta semana|proximos? 7 dias|proximos? siete dias|esta tarde|esta noche|el fin de semana|este fin de semana|a las? \d{1,2}(?::\d{2})?\s*(?:hs?|horas?)?).*$/i, "")
    .trim();
  return place.length >= 2 && !/^(?:ahora|hoy|manana|pasado manana|esta tarde|esta noche|esta semana|el fin de semana|este fin de semana)$/i.test(place);
}

const NAV_ITEMS = [
  { key: "assistant", label: "Hablar" },
  { key: "agenda", label: "Mi día" },
  { key: "tasks", label: "Tareas" },
  { key: "reminders", label: "Avisos" },
  { key: "history", label: "Historial" },
];

function NavIcon({ name }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "agenda") {
    return (
      <svg {...props}>
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
    );
  }
  if (name === "tasks") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    );
  }
  if (name === "reminders") {
    return (
      <svg {...props}>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </svg>
    );
  }
  if (name === "history") {
    return (
      <svg {...props}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <polyline points="3 3 3 9 9 9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M9 22h6" />
    </svg>
  );
}

function App() {
  const storedMember = storedJson(MEMBER_STORAGE_KEY);
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_STORAGE_KEY) || "");
  const [member, setMember] = useState(storedMember);
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem(CONVERSATION_STORAGE_KEY) || "",
  );
  const [phase, setPhase] = useState("idle");
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notice, setNotice] = useState("");
  const [authStep, setAuthStep] = useState("passcode");
  const [passcode, setPasscode] = useState("");
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [musicData, setMusicData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [view, setView] = useState("assistant");
  const [taskScope, setTaskScope] = useState("open");
  const [reminderHours, setReminderHours] = useState(24);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const musicDataRef = useRef(null);
  const currentLocationRef = useRef(null);
  const geolocationDeniedRef = useRef(false);
  const recognitionRef = useRef(null);
  const requestControllerRef = useRef(null);
  const speechRunRef = useRef(0);
  const noticeTimerRef = useRef(null);

  const {
    installed,
    isIos,
    canInstallNative,
    showModal,
    setShowModal,
    triggerInstall,
  } = usePwaInstall();

  const panel = useReadPanel({
    token,
    onUnauthorized: () => clearSession("La sesión venció. Ingresá nuevamente el código familiar."),
  });

  const hasSession = Boolean(token && member?.id);

  useEffect(() => {
    if (!hasSession) return;
    if (view === "agenda") void panel.loadAgenda();
    else if (view === "tasks") void panel.loadTasks(taskScope);
    else if (view === "reminders") void panel.loadReminders(reminderHours);
    else if (view === "history") void panel.loadConversations();
  }, [view, hasSession]);

  useEffect(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (notice) {
      noticeTimerRef.current = setTimeout(() => setNotice(""), 6000);
    }
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, [notice]);

  useEffect(() => () => {
    recognitionRef.current?.recognition.abort();
    requestControllerRef.current?.controller.abort("unmount");
    window.speechSynthesis?.cancel();
  }, []);

  function showNotice(message) {
    setNotice(message);
  }

  async function getCurrentLocation() {
    if (currentLocationRef.current) return currentLocationRef.current;
    if (geolocationDeniedRef.current || !navigator.geolocation) return null;
    try {
      const permission = await navigator.permissions?.query({ name: "geolocation" });
      if (permission?.state === "denied") {
        geolocationDeniedRef.current = true;
        return null;
      }
    } catch {
      // Permissions API no está disponible en todos los navegadores.
    }
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            currentLocationRef.current = { latitude: coords.latitude, longitude: coords.longitude };
            resolve(currentLocationRef.current);
          },
          (error) => {
            if (error.code === 1) geolocationDeniedRef.current = true;
            resolve(null);
          },
          { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 8000 },
        );
      } catch {
        resolve(null);
      }
    });
  }

  function clearSession(message = "") {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(MEMBER_STORAGE_KEY);
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setToken("");
    setMember(null);
    setConversationId("");
    setPasscode("");
    setMembers([]);
    setSelectedMemberId("");
    setAuthStep("passcode");
    setPhase("idle");
    setAnswer("");
    setMusicData(null);
    setWeatherData(null);
    setView("assistant");
    setTaskScope("open");
    setReminderHours(24);
    setSelectedConversationId("");
    musicDataRef.current = null;
    panel.reset();
    if (message) showNotice(message);
  }

  function changeView(nextView) {
    if (nextView === view) return;
    setView(nextView);
    setSelectedConversationId("");
    panel.reset();
  }

  function changeTaskScope(nextScope) {
    setTaskScope(nextScope);
    void panel.loadTasks(nextScope);
  }

  function changeReminderHours(nextHours) {
    setReminderHours(nextHours);
    void panel.loadReminders(nextHours);
  }

  function openConversation(conversationId) {
    setSelectedConversationId(conversationId);
    void panel.loadMessages(conversationId);
  }

  function closeConversation() {
    setSelectedConversationId("");
  }

  async function loadAgendaWeather() {
    const location = await getCurrentLocation();
    if (!location) {
      showNotice("No pude obtener tu ubicación. Revisá los permisos del navegador.");
      return;
    }
    void panel.loadAgenda(location);
  }

  async function loadMembers(event) {
    event.preventDefault();
    setNotice("");
    try {
      const result = await postJson("/api/mobile/session", { passcode });
      if (result.status !== "member_selection_required" || !Array.isArray(result.members)) {
        throw new Error("No pude cargar los integrantes de la familia.");
      }
      if (result.members.length === 0) {
        throw new Error("No hay integrantes disponibles para seleccionar.");
      }
      setMembers(result.members);
      setSelectedMemberId(result.members[0].id);
      setAuthStep("member");
    } catch (error) {
      showNotice(error instanceof TypeError
        ? "No pude conectarme. Revisá tu conexión."
        : error.message || "No pude validar el código familiar.");
    }
  }

  async function startSession(event) {
    event.preventDefault();
    setNotice("");
    try {
      const result = await postJson("/api/mobile/session", {
        passcode,
        speaker_id: selectedMemberId,
      });
      if (!result.token || !result.member?.id) {
        throw new Error("No pude iniciar la sesión.");
      }
      localStorage.setItem(SESSION_STORAGE_KEY, result.token);
      localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(result.member));
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      setToken(result.token);
      setMember(result.member);
      setConversationId("");
      setPasscode("");
      setAuthStep("passcode");
    } catch (error) {
      showNotice(error instanceof TypeError
        ? "No pude conectarme. Revisá tu conexión."
        : error.message || "No pude iniciar la sesión.");
      if (error.status === 401) {
        setAuthStep("passcode");
        setMembers([]);
      }
    }
  }

  function endSpeech() {
    speechRunRef.current += 1;
    window.speechSynthesis?.cancel();
    setPhase("idle");
    if (!musicDataRef.current) {
      setAnswer("");
    }
  }

  function getSpanishVoice() {
    const voices = window.speechSynthesis.getVoices();
    const priorities = ["es-ar", "es-mx", "es-us", "es-es"];
    for (const language of priorities) {
      const matches = voices.filter((voice) => voice.lang.toLowerCase() === language);
      if (matches.length) return matches.find((voice) => voice.localService) || matches[0];
    }
    const spanishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
    return spanishVoices.find((voice) => voice.localService) || spanishVoices[0] || null;
  }

  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setPhase("idle");
      showNotice("La voz no está disponible en este dispositivo.");
      return;
    }

    const chunks = splitSpeechText(text);
    const runId = ++speechRunRef.current;
    setAnswer(text);
    setPhase("speaking");

    const finishSpeech = () => {
      if (speechRunRef.current !== runId) return;
      setPhase("idle");
      if (!musicDataRef.current) setAnswer("");
    };
    const speakChunk = (index, voice) => {
      if (speechRunRef.current !== runId) return;
      if (index >= chunks.length) {
        finishSpeech();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = voice?.lang || "es-AR";
      utterance.rate = 1;
      utterance.pitch = 1;
      if (voice) utterance.voice = voice;
      utterance.onend = () => speakChunk(index + 1, voice);
      utterance.onerror = (event) => {
        if (speechRunRef.current !== runId) return;
        finishSpeech();
        if (event.error !== "canceled" && event.error !== "interrupted") {
          showNotice("No pude reproducir la respuesta en voz alta.");
        }
      };
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      speakChunk(0, getSpanishVoice());
      return;
    }

    let voiceLookupFinished = false;
    const startWhenReady = () => {
      if (voiceLookupFinished || speechRunRef.current !== runId) return;
      voiceLookupFinished = true;
      window.speechSynthesis.onvoiceschanged = null;
      speakChunk(0, getSpanishVoice());
    };
    window.speechSynthesis.onvoiceschanged = startWhenReady;
    window.setTimeout(startWhenReady, 900);
  }

  async function submitQuestion(question) {
    setPhase("processing");
    setAnswer("");
    setMusicData(null);
    setWeatherData(null);
    musicDataRef.current = null;
    const controller = new AbortController();
    const request = { controller, cancelled: false };
    requestControllerRef.current = request;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const weatherQuestion = isWeatherQuestion(question);
      const requestBody = { question };
      if (weatherQuestion) {
        if (!hasExplicitWeatherLocation(question)) {
          const currentLocation = await getCurrentLocation();
          if (currentLocation) requestBody.current_location = currentLocation;
        }
      } else if (conversationId) {
        requestBody.conversation_id = conversationId;
      }
      const result = await postJson(weatherQuestion ? "/api/weather" : "/api/chat", requestBody, token, controller.signal);
      if (request.cancelled) return;
      if (!weatherQuestion && result.conversation_id) {
        setConversationId(result.conversation_id);
        localStorage.setItem(CONVERSATION_STORAGE_KEY, result.conversation_id);
      }
      const text = (result.answer || result.response || "").trim();
      if (!text) throw new Error("El asistente devolvió una respuesta vacía.");

      if (result.music) {
        setMusicData(result.music);
        musicDataRef.current = result.music;
      }
      if (result.weather) setWeatherData(result.weather);

      speak(text);
    } catch (error) {
      if (request.cancelled) return;
      setPhase("idle");
      setAnswer("");
      if (error.status === 401 || error.status === 403) {
        clearSession("La sesión venció. Ingresá nuevamente el código familiar.");
      } else if (error.name === "AbortError") {
        showNotice("La consulta tardó demasiado. Intentá de nuevo.");
      } else if (error instanceof TypeError) {
        showNotice("No pude conectarme con el asistente. Revisá tu conexión.");
      } else {
        showNotice(error.message || "No pude conectarme con el asistente.");
      }
    } finally {
      clearTimeout(timeout);
      if (requestControllerRef.current === request) requestControllerRef.current = null;
    }
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      showNotice("El reconocimiento de voz no está disponible. Probá con Chrome en Android.");
      return;
    }

    setNotice("");
    setTranscript("");
    setAnswer("");
    setMusicData(null);
    setWeatherData(null);
    musicDataRef.current = null;
    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.continuous = true;
    recognition.interimResults = true;
    const session = {
      recognition,
      stopRequested: false,
      finalSegments: new Map(),
      interim: "",
      error: "",
    };
    recognitionRef.current = session;
    recognition.onresult = (event) => {
      session.interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) session.finalSegments.set(index, result[0].transcript);
        else session.interim += result[0].transcript;
      }
      const finalText = [...session.finalSegments.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, text]) => text)
        .join(" ");
      setTranscript([finalText, session.interim].filter(Boolean).join(" ").trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      session.error = FRIENDLY_ERRORS[event.error]
        || "Se interrumpió el reconocimiento de voz.";
    };
    recognition.onend = () => {
      if (recognitionRef.current !== session) return;
      if (!session.stopRequested) {
        if (session.error) {
          recognitionRef.current = null;
          setPhase("idle");
          showNotice(session.error);
          return;
        }
        try {
          session.recognition.start();
        } catch {
          recognitionRef.current = null;
          setPhase("idle");
          showNotice("Se interrumpió la escucha. Tocá para volver a intentar.");
        }
        return;
      }
      recognitionRef.current = null;
      const question = [...session.finalSegments.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, text]) => text)
        .join(" ")
        .trim();
      setTranscript("");
      if (!question) {
        setPhase("idle");
        showNotice(session.error || "No llegué a escucharte. Tocá para intentar otra vez.");
        return;
      }
      void submitQuestion(question);
    };
    try {
      recognition.start();
      setPhase("listening");
    } catch {
      recognitionRef.current = null;
      setPhase("idle");
      showNotice("No pude iniciar el micrófono. Revisá sus permisos.");
    }
  }

  function stopListening() {
    const session = recognitionRef.current;
    if (!session) return;
    // Preservar texto interino que aún no fue confirmado como segmento final
    if (session.interim.trim()) {
      session.finalSegments.set(session.finalSegments.size, session.interim.trim());
      session.interim = "";
    }
    session.stopRequested = true;
    setPhase("processing");
    try {
      session.recognition.stop();
    } catch {
      session.recognition.abort();
      recognitionRef.current = null;
      setPhase("idle");
      showNotice("No pude finalizar la grabación. Intentá de nuevo.");
    }
  }

  function cancelCurrentAction() {
    const session = recognitionRef.current;
    if (session) {
      recognitionRef.current = null;
      session.stopRequested = true;
      try {
        session.recognition.abort();
      } catch {
        // El navegador pudo haber terminado el reconocimiento.
      }
    }

    const request = requestControllerRef.current;
    if (request) {
      request.cancelled = true;
      request.controller.abort("cancelled-by-user");
      if (requestControllerRef.current === request) requestControllerRef.current = null;
    }

    window.speechSynthesis?.cancel();
    setTranscript("");
    setAnswer("");
    setMusicData(null);
    setWeatherData(null);
    musicDataRef.current = null;
    setPhase("idle");
    showNotice("Consulta cancelada.");
  }

  function handleMainButton() {
    if (phase === "idle") startListening();
    else if (phase === "listening") {
      if (recognitionRef.current?.stopRequested || requestControllerRef.current) cancelCurrentAction();
      else stopListening();
    }
    else if (phase === "processing") cancelCurrentAction();
    else if (phase === "speaking") endSpeech();
  }

  function buttonLabel() {
    if (phase === "listening") return "Terminar de hablar";
    if (phase === "processing") return "Cancelar consulta";
    if (phase === "speaking") return "Interrumpir respuesta";
    return "Hablar con Robertito";
  }

  if (!hasSession) {
    return (
      <main className="app-shell auth-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">R</span>
            <span>Robertito</span>
          </div>
          {!installed && (
            <button
              type="button"
              className="install-pill-btn"
              onClick={triggerInstall}
              title="Instalar Robert en tu celular"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Instalar Robert</span>
            </button>
          )}
        </header>
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">ASISTENTE FAMILIAR</p>
          <h1 id="auth-title">
            {authStep === "passcode" ? "Entrá a tu espacio familiar" : "¿Quién está hablando?"}
          </h1>
          <p className="auth-copy">
            {authStep === "passcode"
              ? "Ingresá el código familiar para continuar."
              : "Elegí tu nombre para que Robertito use tu contexto."}
          </p>
          {authStep === "passcode" ? (
            <form className="auth-form" onSubmit={loadMembers}>
              <label htmlFor="family-passcode">Código familiar</label>
              <input
                autoComplete="current-password"
                autoCapitalize="none"
                id="family-passcode"
                onChange={(event) => setPasscode(event.target.value)}
                required
                type="password"
                value={passcode}
              />
              <button className="primary-action" type="submit">Continuar</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={startSession}>
              <label htmlFor="family-member">Integrante</label>
              <select
                id="family-member"
                onChange={(event) => setSelectedMemberId(event.target.value)}
                value={selectedMemberId}
              >
                {members.map((familyMember) => (
                  <option key={familyMember.id} value={familyMember.id}>
                    {familyMember.name}
                  </option>
                ))}
              </select>
              <button className="primary-action" type="submit">Listo</button>
              <button
                className="text-action"
                onClick={() => setAuthStep("passcode")}
                type="button"
              >
                Volver
              </button>
            </form>
          )}
          {notice && <p className="notice" role="alert">{notice}</p>}
        </section>
        <p className="footer-note">Al backend se envía solo el texto.</p>
        <InstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isIos={isIos}
          canInstallNative={canInstallNative}
          onInstallNative={triggerInstall}
        />
      </main>
    );
  }

  const statusText = {
    idle: "Tocá para hablar",
    listening: "Te escucho · tocá al terminar",
    processing: "Estoy pensando… · tocá para cancelar",
    speaking: "Te respondo · tocá para interrumpir",
  }[phase];

  return (
    <main className={`app-shell home-shell phase-${phase}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Robertito</span>
        </div>
        <div className="topbar-actions">
          {!installed && (
            <button
              type="button"
              className="install-pill-btn"
              onClick={triggerInstall}
              title="Instalar Robert en tu celular"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Instalar Robert</span>
            </button>
          )}
          <span className="member-name">{member.name}</span>
        </div>
      </header>

      {view === "assistant" ? (
        <>
      <section className="assistant-stage" aria-label="Asistente por voz">
        <div className="assistant-copy">
          <p className="eyebrow">ASISTENTE FAMILIAR</p>
          <h1>{phase === "speaking" ? "Acá estoy." : "¿En qué te ayudo?"}</h1>
        </div>
        <div className="voice-orb-wrap">
          {phase === "listening" && (
            <div className="waveform" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
          )}
          <button
            aria-label={buttonLabel()}
            className={`voice-orb ${phase === "listening" ? "is-listening" : ""} ${phase === "processing" ? "is-processing" : ""} ${phase === "speaking" ? "is-speaking" : ""}`}
            onClick={handleMainButton}
            type="button"
          >
            <span className="orb-icon" aria-hidden="true">
              {phase === "listening" ? (
                <span className="stop-icon" />
              ) : phase === "processing" ? (
                <span className="cancel-icon" />
              ) : (
                <svg viewBox="0 0 32 32" focusable="false">
                  <rect x="11" y="4" width="10" height="17" rx="5" />
                  <path d="M7 15v1a9 9 0 0 0 18 0v-1M16 25v4M12 29h8" />
                </svg>
              )}
            </span>
          </button>
        </div>
        <p className="state-label" aria-live="polite">{statusText}</p>
        {phase === "idle" && !installed && (
          <button
            type="button"
            className="install-hint-btn"
            onClick={triggerInstall}
          >
            <span>📲 ¿Querés usar Robert como app?</span>
            <span className="install-hint-action">Instalar</span>
          </button>
        )}
        {phase === "listening" && transcript && (
          <p className="transcript" aria-live="polite">{transcript}</p>
        )}
        {answer && (
          <p className="answer-text" aria-live="polite">{answer}</p>
        )}
        {weatherData && <WeatherCard weather={weatherData} />}
        {musicData && (
          <MusicActionHandler
            music={musicData}
            onDismiss={() => {
              setMusicData(null);
              musicDataRef.current = null;
            }}
          />
        )}
        {notice && <p className="notice home-notice" role="alert">{notice}</p>}
      </section>
      <footer className="footer-note">
        <span className="privacy-dot" aria-hidden="true" />
        La ubicación solo se envía para consultas del clima
      </footer>
        </>
      ) : (
        <section className="panel-stage">
          {view === "agenda" && (
            <AgendaView
              agenda={panel.agenda}
              loading={panel.loading}
              error={panel.error}
              onRefresh={() => panel.loadAgenda()}
              onWeather={loadAgendaWeather}
            />
          )}
          {view === "tasks" && (
            <TasksView
              tasks={panel.tasks}
              scope={taskScope}
              onScopeChange={changeTaskScope}
              loading={panel.loading}
              error={panel.error}
              onRefresh={() => panel.loadTasks(taskScope)}
            />
          )}
          {view === "reminders" && (
            <RemindersView
              reminders={panel.reminders}
              hours={reminderHours}
              onHoursChange={changeReminderHours}
              loading={panel.loading}
              error={panel.error}
              onRefresh={() => panel.loadReminders(reminderHours)}
            />
          )}
          {view === "history" && (
            <HistoryView
              conversations={panel.conversations}
              messages={panel.messages}
              selectedId={selectedConversationId}
              onSelect={openConversation}
              onBack={closeConversation}
              loading={panel.loading}
              error={panel.error}
              onRefresh={() => panel.loadConversations()}
            />
          )}
        </section>
      )}
      <nav className="bottom-nav" aria-label="Secciones de la app">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-btn ${view === item.key ? "is-active" : ""}`}
              onClick={() => changeView(item.key)}
              aria-current={view === item.key ? "page" : undefined}
            >
              <NavIcon name={item.key} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <InstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isIos={isIos}
        canInstallNative={canInstallNative}
        onInstallNative={triggerInstall}
      />
    </main>
  );
}

export default App;
