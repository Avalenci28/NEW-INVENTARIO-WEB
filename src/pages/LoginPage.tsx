import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import {Eye, EyeOff, Lock, User} from 'lucide-react';
import {AppLogo} from '../components/AppLogo';
import {MobileShell} from '../components/MobileShell';
import {useAuth} from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const {user, loading, loginWithDemo} = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/inicio', {replace: true});
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Ingresa tu usuario y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithDemo(username, password);
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileShell hideBottomNav>
      <div className="flex min-h-full flex-col bg-white px-5 pt-[calc(24px+env(safe-area-inset-top,0px))] pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.28}}
          className="flex flex-1 flex-col"
        >
          <div className="mb-4">
            <AppLogo size={56} />
          </div>

          <h1 className="text-[26px] font-extrabold tracking-tight text-[#071C2D]">
            Bienvenido de nuevo
          </h1>
          <p className="mt-1 text-sm text-[#5C7B98]">Entra para ver tu inventario</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-semibold text-[#5C7B98]"
              >
                Usuario
              </label>
              <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
                <User className="h-4 w-4 shrink-0 text-[#5C7B98]" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="admin"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-[#5C7B98]"
              >
                Contraseña
              </label>
              <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
                <Lock className="h-4 w-4 shrink-0 text-[#5C7B98]" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              {submitting ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            <div className="rounded-xl border border-[#1F69FC]/20 bg-[#E6EEFF]/60 px-3.5 py-2.5 text-center text-xs text-[#071C2D]">
              <span className="font-bold text-[#1F69FC]">Demo académica:</span> Usuario{' '}
              <span className="font-extrabold">admin</span> · Contraseña{' '}
              <span className="font-extrabold">admin</span>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-[#5C7B98]">o</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/registro')}
              className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-[#071C2D] hover:bg-slate-50 active:scale-[0.99] transition-transform"
            >
              Crear una cuenta nueva
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
        </motion.div>
      </div>
    </MobileShell>
  );
};
