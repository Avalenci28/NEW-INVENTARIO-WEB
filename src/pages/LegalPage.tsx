import React from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft, ShieldCheck} from 'lucide-react';
import {MobileShell} from '../components/MobileShell';

interface LegalPageProps {
  mode: 'privacidad' | 'terminos';
}

export const LegalPage: React.FC<LegalPageProps> = ({mode}) => {
  const navigate = useNavigate();

  return (
    <MobileShell hideBottomNav>
      <div className="min-h-full bg-white px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-[calc(32px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="mb-3 flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-[#071C2D] hover:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2 text-[#1F69FC]">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wide">
            {mode === 'privacidad' ? 'Ley 1581 de 2012 · Colombia' : 'Condiciones de servicio'}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#071C2D]">
          {mode === 'privacidad'
            ? 'Política de tratamiento de datos personales'
            : 'Términos y condiciones de uso'}
        </h1>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#5C7B98]">
          {mode === 'privacidad' ? (
            <>
              <p>
                En cumplimiento de la <strong className="text-[#071C2D]">Ley 1581 de 2012</strong> y
                el Decreto 1377 de 2013 de la República de Colombia,{' '}
                <strong className="text-[#071C2D]">Inventario Fácil IA</strong> protege la
                privacidad de tus datos personales y los de tu negocio.
              </p>
              <p>
                <strong className="text-[#071C2D]">Finalidad:</strong> Tu nombre, correo
                electrónico, nombre del negocio, fotografías de prendas e historial de movimientos se
                utilizan exclusivamente para gestionar tu inventario personal, calcular alertas de
                stock y generar recomendaciones de reposición.
              </p>
              <p>
                <strong className="text-[#071C2D]">Aislamiento y seguridad:</strong> Cada cuenta
                accede únicamente a sus propios registros mediante autenticación y reglas estrictas
                de acceso en la nube. Nunca vendemos ni compartimos tu catálogo con terceros.
              </p>
              <p>
                <strong className="text-[#071C2D]">Tus derechos (Habeas Data):</strong> Puedes
                conocer, actualizar, rectificar o eliminar tus prendas, espacios y perfil en
                cualquier momento directamente desde la aplicación.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong className="text-[#071C2D]">Inventario Fácil IA</strong> ofrece herramientas
                de apoyo para registrar prendas, monitorear mínimos de inventario y sugerir
                cantidades de reposición para pequeños comercios en Colombia.
              </p>
              <p>
                Las sugerencias de reconocimiento por cámara y del asistente IA son una guía para
                agilizar tu operación diaria; te recomendamos revisar siempre las cantidades y
                tallas antes de confirmar un pedido a tus proveedores.
              </p>
              <p>
                Eres responsable de mantener la confidencialidad de tu cuenta y de la veracidad de
                las entradas y salidas registradas en tu negocio.
              </p>
            </>
          )}
        </div>
      </div>
    </MobileShell>
  );
};
