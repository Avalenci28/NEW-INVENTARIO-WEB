import React, {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Link} from 'react-router-dom';
import {BellRing, Database, Download, LogOut, Share, ShieldCheck, Store, X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {NotificationSettingsSheet} from './NotificationSettingsSheet';

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AccountSheet: React.FC<AccountSheetProps> = ({open, onClose}) => {
  const {user, profile, updateUserProfile, logout} = useAuth();
  const {seedDemoData, notificationPrefs} = useInventory();
  const {showToast} = useToast();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [businessName, setBusinessName] = useState(profile?.businessName || '');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !businessName.trim()) {
      showToast('Completa tu nombre y el nombre del negocio.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({fullName, businessName});
      showToast('Perfil actualizado.');
      onClose();
    } catch {
      showToast('No pudimos actualizar tu perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      showToast('Datos de ejemplo cargados en tu inventario.');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudieron cargar los datos.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={onClose}
            className="absolute inset-0 bg-[#0A1F32]/55 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{y: '100%'}}
            animate={{y: 0}}
            exit={{y: '100%'}}
            transition={{type: 'spring', damping: 30, stiffness: 320}}
            className="relative z-10 max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#071C2D]">Mi cuenta y negocio</h2>
                <p className="text-xs text-[#5C7B98]">{user?.email}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName || profile?.fullName || ''}
                  onChange={(e) => setFullName(e.target.value)}
                  className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">
                  Nombre del negocio
                </label>
                <div className="flex min-h-[48px] items-center gap-2 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5">
                  <Store className="h-4 w-4 text-[#5C7B98]" />
                  <input
                    type="text"
                    value={businessName || profile?.businessName || ''}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-transparent text-base text-[#071C2D] focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[48px] w-full rounded-[14px] bg-[#1F69FC] text-sm font-semibold text-white"
              >
                {saving ? 'Guardando...' : 'Actualizar datos'}
              </button>
            </form>

            <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setNotifSheetOpen(true)}
                className="flex min-h-[48px] w-full items-center justify-between rounded-[14px] border border-slate-200 bg-[#F8FAFC] px-4 text-sm font-semibold text-[#071C2D]"
              >
                <span className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[#1F69FC]" />
                  Notificaciones push (FCM)
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    notificationPrefs.pushEnabled
                      ? 'bg-[#E3F7EC] text-[#15803D]'
                      : 'bg-slate-200 text-[#5C7B98]'
                  }`}
                >
                  {notificationPrefs.pushEnabled ? 'Activas' : 'Configurar'}
                </span>
              </button>

              <button
                type="button"
                disabled={seeding}
                onClick={handleSeed}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#1F69FC]/30 bg-[#E6EEFF] px-4 text-sm font-semibold text-[#1F69FC]"
              >
                <Database className="h-4 w-4" />
                {seeding ? 'Cargando ejemplo...' : 'Cargar datos de ejemplo'}
              </button>

              {!isInstalled && (isInstallable || isIOS) && (
                <button
                  type="button"
                  onClick={() => {
                    if (isInstallable) {
                      void install();
                    } else {
                      setShowIOSGuide((v) => !v);
                    }
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-[#071C2D]"
                >
                  <Download className="h-4 w-4 text-[#1F69FC]" />
                  Instalar en mi celular (PWA)
                </button>
              )}

              {showIOSGuide && (
                <div className="rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#071C2D] border border-slate-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <Share className="h-3.5 w-3.5 text-[#1F69FC]" />
                    Instalar en iPhone (Safari):
                  </p>
                  <p className="mt-1 text-[#5C7B98]">
                    1. Toca el botón <strong>Compartir</strong> abajo en Safari.
                    <br />
                    2. Baja y elige <strong>Agregar a inicio</strong>.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 pt-1 text-xs text-[#5C7B98]">
                <Link to="/privacidad" onClick={onClose} className="inline-flex items-center gap-1 underline">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ley 1581 de 2012
                </Link>
                <Link to="/terminos" onClick={onClose} className="underline">
                  Términos
                </Link>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-red-50 text-sm font-semibold text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <NotificationSettingsSheet
      open={notifSheetOpen}
      onClose={() => setNotifSheetOpen(false)}
    />
    </>
  );
};
