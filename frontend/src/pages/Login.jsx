import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, LogIn, ShieldCheck, CalendarCheck, Users } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../i18n/errors';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('validation.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('validation.emailInvalid'));
      return;
    }
    if (!password) {
      setError(t('validation.passwordRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(t('auth.welcome', { name: user.fullName.split(' ')[0] }));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err.status === 401
          ? t('auth.invalidCredentials')
          : getApiErrorMessage(err, t, 'errors.login'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  }

  return (
    <div className="login">
      <section className="login__brand">
        <div className="login__brand-inner">
          <div className="login__logo">
            <HeartPulse size={26} />
            <span>{t('app.name')}</span>
          </div>
          <h1>{t('auth.brandHeadline')}</h1>
          <p>{t('auth.brandDescription')}</p>
          <ul className="login__features">
            <li>
              <Users size={18} /> {t('auth.featureRecords')}
            </li>
            <li>
              <CalendarCheck size={18} /> {t('auth.featureScheduling')}
            </li>
            <li>
              <ShieldCheck size={18} /> {t('auth.featureSecurity')}
            </li>
          </ul>
        </div>
      </section>

      <section className="login__panel">
        <div className="login__lang">
          <LanguageSwitcher id="login-language" />
        </div>
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <header>
            <h2>{t('auth.signIn')}</h2>
            <p>{t('auth.signInSubtitle')}</p>
          </header>

          {error ? <div className="form__alert">{error}</div> : null}

          <div className="field">
            <label htmlFor="email">{t('fields.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">{t('fields.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            <LogIn size={18} />
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <div className="login__demo">
            <p>{t('auth.demoAccounts')}</p>
            <div className="login__demo-grid">
              <button type="button" onClick={() => fillDemo('admin@clinicflow.dev', 'Admin@123')}>
                <strong>{t('auth.adminShort')}</strong>
                <small>admin@clinicflow.dev</small>
              </button>
              <button type="button" onClick={() => fillDemo('staff@clinicflow.dev', 'Staff@123')}>
                <strong>{t('auth.staffShort')}</strong>
                <small>staff@clinicflow.dev</small>
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
