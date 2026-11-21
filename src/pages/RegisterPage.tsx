import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowLeft, Eye, EyeOff, Lock, Mail, Store, User} from 'lucide-react';
import {z} from 'zod';
import {MobileShell} from '../components/MobileShell';
import {mapAuthErrorMessage, useAuth} from '../context/AuthContext';
import {useToast} from '../context/ToastContext';

const RegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresa tu nombre completo.'),
  businessName: z.string().trim().min(2, 'Ingresa el nombre de tu negocio.'),
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(8, 'La contraseña debe tener mínimo 8 caracteres.'),
});

export const RegisterPage: React.FC = () => {
  const {user, loading, registerWithEmail, loginWithGoogle} = useAuth();
  const {showToast} = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

    const parsed = RegisterSchema.safeParse({fullName, businessName, email, password});
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || 'Revisa los datos ingresados.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('Debes aceptar el tratamiento de datos según la Ley 1581 de 2012.');
      return;
    }

    setSubmitting(true);
    try {
      await registerWithEmail(parsed.data);
      showToast('¡Cuenta creada! Bienvenido a Inventario Fácil IA.');
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    if (!acceptedTerms) {
      setErrorMsg('Acepta primero la Ley 1581 de 2012 para crear tu cuenta con Google.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithGoogle(businessName.trim() || undefined);
      showToast('Sesión iniciada con Google.');
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileShell hideBottomNav>
      <div className="flex min-h-full flex-col bg-white px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => navigate('/')}
          className="mb-3 flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-[#071C2D] hover:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h1 className="text-[26px] font-extrabold tracking-tight text-[#071C2D]">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-[#5C7B98]">Empieza con el plan gratuito</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
              Nombre completo
            </label>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
              <User className="h-4 w-4 shrink-0 text-[#5C7B98]" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alison Lara"
                autoComplete="name"
                className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
              Nombre del negocio
            </label>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
              <Store className="h-4 w-4 shrink-0 text-[#5C7B98]" />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Mi tienda de ropa"
                className="w-full bg-transparent text-base text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

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
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
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
          </div>

          <label className="flex items-start gap-3 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-[#1F69FC]"
            />
            <span className="text-xs leading-relaxed text-[#5C7B98]">
              Acepto el tratamiento de mis datos personales según la{' '}
              <Link to="/privacidad" className="font-semibold text-[#1F69FC] underline">
                Ley 1581 de 2012
              </Link>{' '}
              y los{' '}
              <Link to="/terminos" className="font-semibold text-[#1F69FC] underline">
                Términos
              </Link>
              .
            </span>
          </label>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-[#071C2D] hover:bg-slate-50"
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

        <p className="mt-auto pt-6 text-center text-sm text-[#5C7B98]">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-bold text-[#1F69FC]">
            Inicia sesión
          </Link>
        </p>
      </div>
    </MobileShell>
  );
};
