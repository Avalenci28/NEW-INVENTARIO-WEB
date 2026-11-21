import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowLeft, Eye, EyeOff, Lock, Mail, Store, User} from 'lucide-react';
import {z} from 'zod';
import {MobileShell} from '../components/MobileShell';
import {useAuth} from '../context/AuthContext';
import {useToast} from '../context/ToastContext';

const RegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresa tu nombre completo.'),
  businessName: z.string().trim().min(2, 'Ingresa el nombre de tu negocio.'),
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(4, 'La contraseña debe tener mínimo 4 caracteres.'),
});

export const RegisterPage: React.FC = () => {
  const {user, loading, registerDemoAccount} = useAuth();
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
      await registerDemoAccount(parsed.data);
      showToast('¡Cuenta creada! Bienvenido a Inventario Fácil IA.');
      navigate('/inicio', {replace: true});
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'No pudimos crear la cuenta demo. Intenta de nuevo.',
      );
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
                autoCapitalize="none"
                autoCorrect="off"
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
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
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
            className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
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
