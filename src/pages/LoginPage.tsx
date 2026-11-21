import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {AnimatePresence, motion} from 'motion/react';
import {Eye, EyeOff, Lock, Mail, X} from 'lucide-react';
import {AppLogo} from '../components/AppLogo';
import {MobileShell} from '../components/MobileShell';
import {mapAuthErrorMessage, useAuth} from '../context/AuthContext';
import {useToast} from '../context/ToastContext';

export const LoginPage: React.FC = () => {
  const {user, loading, loginWithEmail, loginWithGoogle, resetPassword} = useAuth();
  const {showToast} = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/inicio', {replace: true});
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      showToast('Escribe tu correo electrónico.', 'error');
      return;
    }
    setResetSending(true);
    try {
      await resetPassword(resetEmail);
      showToast('Te enviamos un enlace a tu correo para restablecer la contraseña.');
      setResetOpen(false);
    } catch (err) {
      showToast(mapAuthErrorMessage(err), 'error');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <MobileShell hideBottomNav>
      <div className="flex min-h-full flex-col bg-white px-5 pt-[calc(24px+env(safe-area-inset-top,0px))] pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <div className="mb-4">
          <AppLogo size={56} />
        </div>

        <h1 className="text-[26px] font-extrabold tracking-tight text-[#071C2D]">
          Bienvenido de nuevo
        </h1>
        <p className="mt-1 text-sm text-[#5C7B98]">Entra para ver tu inventario</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
              Correo electrónico
            </label>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
              <Mail className="h-4 w-4 shrink-0 text-[#5C7B98]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">Contraseña</label>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
              <Lock className="h-4 w-4 shrink-0 text-[#5C7B98]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                onClick={() => setShowPassword((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#5C7B98]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetOpen(true);
                }}
                className="text-xs font-semibold text-[#1F69FC]"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-[#5C7B98]">o</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => navigate('/registro')}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-[#071C2D] hover:bg-slate-50"
          >
            Crear una cuenta nueva
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-slate-200 bg-[#F8FAFC] px-4 text-sm font-semibold text-[#071C2D] hover:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            Continuar con Google
          </button>
        </form>

        <div className="mt-auto flex items-center justify-center gap-1.5 pt-6 text-xs text-[#5C7B98]">
          <Lock className="h-3.5 w-3.5" />
          <span>
            Tus datos se protegen según la{' '}
            <Link to="/privacidad" className="underline">
              Ley 1581 de 2012
            </Link>
          </span>
        </div>
      </div>

      {/* Hoja inferior de recuperación de contraseña */}
      <AnimatePresence>
        {resetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              onClick={() => setResetOpen(false)}
              className="absolute inset-0 bg-[#0A1F32]/55 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{y: '100%'}}
              animate={{y: 0}}
              exit={{y: '100%'}}
              transition={{type: 'spring', damping: 30, stiffness: 320}}
              className="relative z-10 w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#071C2D]">Recuperar contraseña</h2>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setResetOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-[#5C7B98]">
                Ingresa tu correo y te enviaremos un enlace para crear una contraseña nueva.
              </p>
              <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D] focus:border-[#1F69FC] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={resetSending}
                  className="min-h-[48px] w-full rounded-[14px] bg-[#1F69FC] text-sm font-bold text-white"
                >
                  {resetSending ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MobileShell>
  );
};
