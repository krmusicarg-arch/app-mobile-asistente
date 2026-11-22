import React from "react";

export function InstallModal({ isOpen, onClose, isIos, canInstallNative, onInstallNative }) {
  if (!isOpen) return null;

  return (
    <div className="install-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="install-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="install-modal-header">
          <div className="install-modal-brand">
            <span className="brand-mark" aria-hidden="true">R</span>
            <div>
              <h2 id="install-title">Instalar Robert</h2>
              <p className="install-subtitle">Asistente Familiar</p>
            </div>
          </div>
          <button
            type="button"
            className="install-modal-close"
            onClick={onClose}
            aria-label="Cerrar modal de instalación"
          >
            ✕
          </button>
        </div>

        <div className="install-modal-body">
          {isIos ? (
            <div className="install-steps">
              <p className="install-intro">
                Para instalar Robert en tu <strong>iPhone o iPad</strong>, seguí estos 3 pasos en <strong>Safari</strong>:
              </p>
              <ol className="install-steps-list">
                <li className="install-step-item">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <span>Tocá el botón <strong>Compartir</strong> en la barra inferior de Safari.</span>
                    <span className="step-icon-badge" title="Botón Compartir">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </span>
                  </div>
                </li>
                <li className="install-step-item">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <span>Deslizá hacia abajo y seleccioná <strong>"Agregar a pantalla de inicio"</strong>.</span>
                    <span className="step-icon-badge" title="Agregar a pantalla de inicio">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    </span>
                  </div>
                </li>
                <li className="install-step-item">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <span>En la esquina superior derecha, tocá <strong>"Agregar"</strong>.</span>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            <div className="install-steps">
              <p className="install-intro">
                Instalá Robert en tu teléfono para abrirlo como una aplicación directa y a pantalla completa:
              </p>

              {canInstallNative ? (
                <div className="install-native-action">
                  <p className="install-highlight">Tu navegador permite la instalación inmediata.</p>
                  <button
                    type="button"
                    className="primary-action install-btn-full"
                    onClick={() => {
                      onInstallNative();
                      onClose();
                    }}
                  >
                    Instalar ahora en el celular
                  </button>
                </div>
              ) : (
                <ol className="install-steps-list">
                  <li className="install-step-item">
                    <span className="step-number">1</span>
                    <div className="step-content">
                      <span>Abrí el menú del navegador (los <strong>tres puntos ⋮</strong> arriba a la derecha).</span>
                    </div>
                  </li>
                  <li className="install-step-item">
                    <span className="step-number">2</span>
                    <div className="step-content">
                      <span>Tocá <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</span>
                    </div>
                  </li>
                  <li className="install-step-item">
                    <span className="step-number">3</span>
                    <div className="step-content">
                      <span>Confirmá la instalación para tener el ícono de Robert en tu pantalla.</span>
                    </div>
                  </li>
                </ol>
              )}
            </div>
          )}
        </div>

        <div className="install-modal-footer">
          <button type="button" className="text-action" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
