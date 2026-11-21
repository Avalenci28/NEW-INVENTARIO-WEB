import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import {AppLogo} from '../components/AppLogo';
import {MobileShell} from '../components/MobileShell';
import {useAuth} from '../context/AuthContext';

export const WelcomePage: React.FC = () => {
  const {user, loading} = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/inicio', {replace: true});
    }
  }, [user, loading, navigate]);

  return (
    <MobileShell hideBottomNav darkBackground>
      <div className="relative flex min-h-full flex-col justify-between px-6 pt-[calc(40px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))] text-white">
        {/* Brillo sutil decorativo detrás del logo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#1F69FC]/15 blur-3xl"
        />

        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.35}}
          className="relative flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-[28px] bg-white/5 ring-1 ring-white/10">
            <AppLogo size={88} />
          </div>

          <h1 className="text-[28px] font-extrabold tracking-tight text-white">
            Inventario Fácil IA
          </h1>
          <p className="mt-2.5 max-w-[270px] text-[15px] leading-relaxed text-slate-300">
            Tu inventario inteligente, siempre bajo control
          </p>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <span className="rounded-full bg-[#EF8D2A] px-4 py-1.5 text-xs font-bold text-white shadow-sm">
              Registra
            </span>
            <span className="rounded-full bg-[#1F69FC] px-4 py-1.5 text-xs font-bold text-white shadow-sm">
              Alerta
            </span>
            <span className="rounded-full bg-[#24B570] px-4 py-1.5 text-xs font-bold text-white shadow-sm">
              Decide
            </span>
          </div>
        </motion.div>

        <div className="relative space-y-3 pt-6">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-5 text-[15px] font-bold text-white shadow-lg shadow-[#1F69FC]/25 active:scale-[0.99] transition-transform"
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            onClick={() => navigate('/registro')}
            className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-white/25 bg-white/5 px-5 text-[15px] font-semibold text-white active:scale-[0.99] transition-transform"
          >
            Crear cuenta
          </button>

          <p className="pt-2 text-center text-xs text-slate-400">
            Para tiendas de ropa y emprendimientos
          </p>
        </div>
      </div>
    </MobileShell>
  );
};
