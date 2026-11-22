import React from "react";

function formatTime(value, timezone) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function temperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°` : "—";
}

export function WeatherCard({ weather }) {
  if (!weather) return null;
  const location = [weather.location?.name, weather.location?.admin1, weather.location?.country]
    .filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(", ");

  return (
    <section className="weather-card" aria-label="Pronóstico del tiempo">
      {weather.needsClarification ? (
        <>
          <p className="weather-eyebrow">¿QUÉ LOCALIDAD?</p>
          <p className="weather-question">Hay más de una coincidencia:</p>
          <ul className="weather-candidates">
            {(weather.candidates || []).map((candidate, index) => (
              <li key={`${candidate.name}-${candidate.admin1}-${index}`}>
                {[candidate.name, candidate.admin1, candidate.country].filter(Boolean).join(", ")}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="weather-card-heading">
            <div>
              <p className="weather-eyebrow">{weather.periodLabel || "CLIMA"}</p>
              <h2 className="weather-location">{location}</h2>
              <p className="weather-updated">Actualizado: {formatTime(weather.updatedAt, weather.timezone)}</p>
            </div>
            <span className="weather-main-icon" aria-hidden="true">{weather.icon || "🌡️"}</span>
          </div>

          {weather.current && (
            <div className="weather-current">
              <span className="weather-current-temp">{temperature(weather.current.temperature)}</span>
              <div>
                <strong>{weather.current.description}</strong>
                <span> Sensación {temperature(weather.current.apparentTemperature)}</span>
                {Number.isFinite(weather.current.relativeHumidity) && <span> · Humedad {Math.round(weather.current.relativeHumidity)}%</span>}
                {Number.isFinite(weather.current.windSpeed) && <span> · Viento {Math.round(weather.current.windSpeed)} km/h</span>}
              </div>
            </div>
          )}

          {weather.days?.length > 0 && (
            <div className={`weather-days ${weather.days.length > 1 ? "is-week" : ""}`}>
              {weather.days.map((day) => (
                <div className="weather-day" key={day.date}>
                  <span className="weather-day-name">{weather.days.length > 1 ? day.label : weather.periodLabel}</span>
                  <span className="weather-day-icon" aria-hidden="true">{day.icon}</span>
                  <span className="weather-day-temp">{temperature(day.temperatureMin)} / {temperature(day.temperatureMax)}</span>
                  {Number.isFinite(day.precipitationProbability) && <span className="weather-rain">☂ {Math.round(day.precipitationProbability)}%</span>}
                  {day.description && <span className="weather-day-description">{day.description}</span>}
                </div>
              ))}
            </div>
          )}

          {weather.hours?.length > 0 && (
            <div className="weather-hours">
              {weather.hours.map((hour) => (
                <div className="weather-hour" key={hour.time}>
                  <span>{hour.time.slice(11, 16)}</span>
                  <span aria-hidden="true">{hour.icon}</span>
                  <strong>{temperature(hour.temperature)}</strong>
                  {Number.isFinite(hour.precipitationProbability) && <span>☂ {Math.round(hour.precipitationProbability)}%</span>}
                </div>
              ))}
            </div>
          )}
          {weather.usedDefaultLocation && <p className="weather-default-note">Usé la localidad predeterminada porque no se compartió la ubicación.</p>}
        </>
      )}
      <p className="weather-attribution">Datos meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a></p>
    </section>
  );
}
