import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_ASSISTANT_BACKEND_URL || "").replace(/\/$/, "");
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

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function postJson(path, body, token, signal) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
  if (!response.ok) {
    const messages = {
      invalid_passcode: "El código familiar no es correcto.",
      invalid_speaker: "Ese integrante ya no está disponible.",
      speaker_mismatch: "La sesión no corresponde al integrante seleccionado.",
    };
    const error = new Error(
      payload.answer || messages[payload.status] || "No pude completar la consulta.",
    );
    error.status = response.status;
    error.code = payload.status;
    throw error;
  }
  return payload;
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
  const recognitionRef = useRef(null);
  const speechRunRef = useRef(0);
  const noticeTimerRef = useRef(null);

  const hasSession = Boolean(token && member?.id);

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
    window.speechSynthesis?.cancel();
  }, []);

  function showNotice(message) {
    setNotice(message);
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
    if (message) showNotice(message);
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
    setAnswer("");
  }

  function getSpanishVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.toLowerCase() === "es-ar")
      || voices.find((v) => v.lang.toLowerCase().startsWith("es"))
      || null;
  }

  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setPhase("idle");
      showNotice("La voz no está disponible en este dispositivo.");
      return;
    }

    const runId = ++speechRunRef.current;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-AR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (speechRunRef.current !== runId) return;
      setPhase("idle");
      setAnswer("");
    };
    utterance.onerror = (event) => {
      if (speechRunRef.current !== runId) return;
      setPhase("idle");
      setAnswer("");
      if (event.error !== "canceled" && event.error !== "interrupted") {
        showNotice("No pude reproducir la respuesta en voz alta.");
      }
    };
    setAnswer(text);
    setPhase("speaking");

    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      // Chrome para Android carga las voces de forma asíncrona
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        if (speechRunRef.current !== runId) return;
        utterance.voice = getSpanishVoice();
        window.speechSynthesis.speak(utterance);
      };
    } else {
      utterance.voice = getSpanishVoice();
      window.speechSynthesis.speak(utterance);
    }
  }

  async function submitQuestion(question) {
    setPhase("processing");
    setAnswer("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const result = await postJson("/api/chat", {
        question,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }, token, controller.signal);
      if (result.conversation_id) {
        setConversationId(result.conversation_id);
        localStorage.setItem(CONVERSATION_STORAGE_KEY, result.conversation_id);
      }
      const text = (result.answer || result.response || "").trim();
      if (!text) throw new Error("El asistente devolvió una respuesta vacía.");
      speak(text);
    } catch (error) {
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

  function handleMainButton() {
    if (phase === "idle") startListening();
    else if (phase === "listening") stopListening();
    else if (phase === "speaking") endSpeech();
  }

  function buttonLabel() {
    if (phase === "listening") return "Terminar de hablar";
    if (phase === "processing") return "Procesando";
    if (phase === "speaking") return "Interrumpir respuesta";
    return "Hablar con Robertito";
  }

  if (!hasSession) {
    return (
      <main className="app-shell auth-shell">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Robertito</span>
        </div>
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
      </main>
    );
  }

  const statusText = {
    idle: "Tocá para hablar",
    listening: "Te escucho · tocá al terminar",
    processing: "Estoy pensando…",
    speaking: "Te respondo · tocá para interrumpir",
  }[phase];

  return (
    <main className={`app-shell home-shell phase-${phase}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Robertito</span>
        </div>
        <span className="member-name">{member.name}</span>
      </header>

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
            disabled={phase === "processing"}
            onClick={handleMainButton}
            type="button"
          >
            <span className="orb-icon" aria-hidden="true">
              {phase === "listening" ? (
                <span className="stop-icon" />
              ) : phase === "processing" ? (
                <span className="spinner" />
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
        {phase === "listening" && transcript && (
          <p className="transcript" aria-live="polite">{transcript}</p>
        )}
        {phase === "speaking" && answer && (
          <p className="answer-text" aria-live="polite">{answer}</p>
        )}
        {notice && <p className="notice home-notice" role="alert">{notice}</p>}
      </section>
      <footer className="footer-note">
        <span className="privacy-dot" aria-hidden="true" />
        Al backend se envía solo el texto
      </footer>
    </main>
  );
}

export default App;
