import React, { useState } from "react";

export function MusicActionHandler({ music, onDismiss }) {
  const [errorMsg, setErrorMsg] = useState("");

  if (!music || !Array.isArray(music.actions) || music.actions.length === 0) {
    return null;
  }

  function handleActionClick(action) {
    setErrorMsg("");
    if (!action.url || !action.url.startsWith("https://")) {
      setErrorMsg("El enlace de música no es válido.");
      return;
    }

    try {
      // Abrir en nueva pestaña o lanzar app nativa si está asociada en Android/iOS
      const targetWindow = window.open(action.url, "_blank", "noopener,noreferrer");
      if (!targetWindow || targetWindow.closed || typeof targetWindow.closed === "undefined") {
        window.location.assign(action.url);
      }
    } catch (err) {
      console.warn("[Music] Error abriendo enlace musical:", err);
      window.location.href = action.url;
    }
  }

  return (
    <div className="music-action-card" role="region" aria-label="Opciones de música">
      <div className="music-action-header">
        <span className="music-badge">🎵 MÚSICA</span>
        {onDismiss && (
          <button
            type="button"
            className="music-dismiss-btn"
            onClick={onDismiss}
            aria-label="Ocultar opciones de música"
            title="Cerrar"
          >
            ✕
          </button>
        )}
      </div>

      <div className="music-actions-list">
        {music.actions.map((action) => {
          const isSpotify = action.provider === "spotify";
          return (
            <button
              key={action.id}
              type="button"
              className={`music-btn ${isSpotify ? "music-btn-spotify" : "music-btn-ytmusic"}`}
              onClick={() => handleActionClick(action)}
            >
              <span className="music-btn-icon" aria-hidden="true">
                {isSpotify ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1ed760">
                    <circle cx="12" cy="12" r="10" fill="#1ed760" />
                    <path
                      d="M7 9.5c3.2-0.8 6.5-0.5 9.2 0.8M7.8 12.3c2.5-0.6 5.1-0.4 7.3 0.7M8.5 15.2c1.9-0.5 4-0.3 5.7 0.6"
                      stroke="#111313"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff0033">
                    <circle cx="12" cy="12" r="10" fill="#ff0033" />
                    <circle cx="12" cy="12" r="4.5" fill="#111313" />
                    <polygon points="10.5,9.8 14.5,12 10.5,14.2" fill="#fff" />
                  </svg>
                )}
              </span>
              <span className="music-btn-label">{action.label}</span>
              <svg
                className="music-btn-arrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          );
        })}
      </div>
      {errorMsg && <p className="music-error" role="alert">{errorMsg}</p>}
    </div>
  );
}
