import React, { createContext, useContext, useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  isToastEnabled: boolean;
  setToastEnabled: (enabled: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isToastEnabled, setToastEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nexus-toasts-enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      console.warn("Failed to parse toasts enabled state, resetting:", e);
      localStorage.removeItem('nexus-toasts-enabled');
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('nexus-toasts-enabled', JSON.stringify(isToastEnabled));
  }, [isToastEnabled]);

  const showToast = (message: string, type: ToastType = 'info') => {
    if (!isToastEnabled) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after exactly 2 seconds
    setTimeout(() => {
      removeToast(id);
    }, 2000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, isToastEnabled, setToastEnabled }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-item toast-${t.type}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              border: `1px solid ${
                t.type === 'success'
                  ? 'var(--success)'
                  : t.type === 'error'
                  ? 'var(--danger)'
                  : t.type === 'warning'
                  ? 'var(--warning)'
                  : 'var(--accent-primary)'
              }`,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'auto',
              minWidth: '280px',
              maxWidth: '400px',
              animation: 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {t.type === 'success' && <CheckCircle size={18} color="var(--success)" />}
              {t.type === 'error' && <AlertTriangle size={18} color="var(--danger)" />}
              {t.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
              {t.type === 'info' && <Info size={18} color="var(--accent-primary)" />}
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
