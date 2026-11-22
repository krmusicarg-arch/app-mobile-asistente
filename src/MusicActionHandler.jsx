import React from "react";

function validAction(action) {
  if (!action || typeof action.url !== "string") return false;
  try {
    const url = new URL(action.url);
    const host = action.provider === "youtube_music" ? "music.youtube.com"
      : action.provider === "spotify" ? "open.spotify.com" : "";
    return url.protocol === "https:" && url.hostname === host;
  } catch {
    return false;
  }
}

export function MusicActionHandler({ music, onDismiss }) {
  if (!music || !Array.isArray(music.actions) || music.actions.length === 0) return null;

  const actions = music.actions.filter(validAction);
  if (actions.length === 0) return null;

  return (
    <div className="music-action-card" role="region" aria-label="Opciones de música">
      <div className="music-result">
        {music.imageUrl && music.found !== false && (
          <img className="music-cover" src={music.imageUrl} alt="" loading="lazy" />
        )}
        <div className="music-result-copy">
          <span className="music-badge">{music.found === false ? "BÚSQUEDA MUSICAL" : "ENCONTRÉ ESTA CANCIÓN"}</span>
          {music.found !== false && (music.title || music.artist) && (
            <>
              {music.title && <h2 className="music-title">{music.title}</h2>}
              {music.artist && <p className="music-artist">{music.artist}</p>}
            </>
          )}
          <p className="music-message">{music.message || "¿Dónde querés escucharlo?"}</p>
        </div>
        {onDismiss && (
          <button type="button" className="music-dismiss-btn" onClick={onDismiss} aria-label="Ocultar opciones de música" title="Cerrar">✕</button>
        )}
      </div>

      <div className="music-actions-list">
        {actions.map((action) => {
          const isSpotify = action.provider === "spotify";
          return (
            <a
              key={action.id}
              className={`music-btn ${isSpotify ? "music-btn-spotify" : "music-btn-ytmusic"}`}
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={action.label}
            >
              <span className="music-btn-icon" aria-hidden="true">
                {isSpotify ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1ed760"><circle cx="12" cy="12" r="10" fill="#1ed760" /><path d="M7 9.5c3.2-0.8 6.5-0.5 9.2 0.8M7.8 12.3c2.5-0.6 5.1-0.4 7.3 0.7M8.5 15.2c1.9-0.5 4-0.3 5.7 0.6" stroke="#111313" strokeWidth="1.8" strokeLinecap="round" fill="none" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff0033"><circle cx="12" cy="12" r="10" fill="#ff0033" /><circle cx="12" cy="12" r="4.5" fill="#111313" /><polygon points="10.5,9.8 14.5,12 10.5,14.2" fill="#fff" /></svg>
                )}
              </span>
              <span className="music-btn-label">{action.label}</span>
              <svg className="music-btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
          );
        })}
      </div>
      <p className="music-open-note">Se abrirá la app si el dispositivo admite el enlace; si no, continuará en el navegador.</p>
    </div>
  );
}
