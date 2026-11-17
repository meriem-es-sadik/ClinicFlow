import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'success') => {
      const id = ++idCounter;
      setToasts((current) => [...current, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span className="toast__icon">{iconFor(toast.type)}</span>
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => remove(toast.id)}
              aria-label={t('common.dismissNotification')}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function iconFor(type) {
  if (type === 'error') return <AlertCircle size={18} />;
  if (type === 'info') return <Info size={18} />;
  return <CheckCircle2 size={18} />;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
