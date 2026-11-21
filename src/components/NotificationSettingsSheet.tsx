import React, {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Bell, BellRing, CalendarClock, CheckCircle2, Share, Smartphone, X} from 'lucide-react';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {isBrowserNotificationSupported, isIOSBrowserNotStandalone} from '../lib/fcm';

interface NotificationSettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationSettingsSheet: React.FC<NotificationSettingsSheetProps> = ({
  open,
  onClose,
}) => {
  const {
    fcmTokens,
    notificationPrefs,
    saveNotificationPrefs,
    activatePushNotifications,
    sendTestDeviceNotification,
  } = useInventory();
  const {showToast} = useToast();

  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const supported = isBrowserNotificationSupported();
  const iosNeedsHomeScreen = isIOSBrowserNotStandalone();
  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : ('default' as NotificationPermission);

  const handleTogglePush = async () => {
    setBusy(true);
    try {
      if (!notificationPrefs.pushEnabled) {
        const res = await activatePushNotifications();
        if (res.permission === 'denied') {
          showToast(
            'El navegador bloqueó las notificaciones. Actívalas en la configuración del sitio.',
            'error',
          );
          return;
        }
        if (res.permission === 'granted') {
          showToast(
            res.fcmToken
              ? 'Notificaciones push FCM activadas en este dispositivo.'
              : 'Notificaciones activadas en este dispositivo.',
          );
        }
      } else {
        await saveNotificationPrefs({
          ...notificationPrefs,
          pushEnabled: false,
        });
        showToast('Notificaciones push pausadas.');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudieron configurar las notificaciones.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePrefChange = async (
    patch: Partial<{lowStockEnabled: boolean; expiringEnabled: boolean; expiryWarningDays: number}>,
  ) => {
    try {
      await saveNotificationPrefs({
        pushEnabled: notificationPrefs.pushEnabled,
        lowStockEnabled: patch.lowStockEnabled ?? notificationPrefs.lowStockEnabled,
        expiringEnabled: patch.expiringEnabled ?? notificationPrefs.expiringEnabled,
        expiryWarningDays: patch.expiryWarningDays ?? notificationPrefs.expiryWarningDays,
      });
    } catch {
      showToast('No pudimos guardar tus preferencias.', 'error');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (permission !== 'granted') {
        const res = await activatePushNotifications();
        if (res.permission !== 'granted') {
          showToast('Otorga permiso de notificaciones para enviar la prueba.', 'info');
          return;
        }
      }
      const sent = await sendTestDeviceNotification();
      if (sent) {
        showToast('Notificación enviada a tu dispositivo.');
      } else {
        showToast('No fue posible mostrar la notificación en este entorno.', 'info');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
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
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6EEFF] text-[#1F69FC]">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[19px] font-bold text-[#071C2D]">Notificaciones push</h2>
                  <p className="text-xs text-[#5C7B98]">Firebase Cloud Messaging</p>
                </div>
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

            {iosNeedsHomeScreen && (
              <div className="mb-4 rounded-2xl border border-[#1F69FC]/25 bg-[#E6EEFF]/70 p-3.5 text-xs text-[#071C2D]">
                <p className="flex items-center gap-1.5 font-bold text-[#1F69FC]">
                  <Share className="h-4 w-4" />
                  Instala la app en iPhone para recibir push
                </p>
                <p className="mt-1 leading-relaxed text-[#5C7B98]">
                  En iOS Safari debes tocar <strong>Compartir</strong> y luego{' '}
                  <strong>Agregar a inicio</strong>; al abrirla desde el ícono podrás activar las
                  notificaciones push.
                </p>
              </div>
            )}

            {!supported && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-[#FFF1E0] p-3.5 text-xs text-[#9A3412]">
                Este navegador no admite notificaciones push del sistema. Seguirás viendo todas las
                alertas en la pestaña Alertas.
              </div>
            )}

            <div className="space-y-3">
              {/* Interruptor principal */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#071C2D]">Alertas en este dispositivo</p>
                  <p className="mt-0.5 text-xs text-[#5C7B98]">
                    {notificationPrefs.pushEnabled && permission === 'granted'
                      ? fcmTokens.length > 0
                        ? `Activo · ${fcmTokens.length} dispositivo(s) FCM`
                        : 'Activo en este navegador'
                      : 'Desactivado'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !supported}
                  onClick={handleTogglePush}
                  className={`min-h-[42px] shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${
                    notificationPrefs.pushEnabled && permission === 'granted'
                      ? 'bg-[#24B570] text-white'
                      : 'bg-[#1F69FC] text-white'
                  } disabled:opacity-50`}
                >
                  {busy
                    ? 'Activando...'
                    : notificationPrefs.pushEnabled && permission === 'granted'
                      ? 'Activadas'
                      : 'Activar'}
                </button>
              </div>

              {/* Qué alertar */}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
                <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-[#EF8D2A]" />
                    <div>
                      <p className="text-sm font-semibold text-[#071C2D]">Stock bajo y agotados</p>
                      <p className="text-xs text-[#5C7B98]">
                        Cuando baje del mínimo o queden menos de 7 días
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.lowStockEnabled}
                    onChange={(e) => void handlePrefChange({lowStockEnabled: e.target.checked})}
                    className="h-5 w-5 accent-[#1F69FC]"
                  />
                </label>

                <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="h-4 w-4 text-[#1F69FC]" />
                    <div>
                      <p className="text-sm font-semibold text-[#071C2D]">
                        Prendas próximas a caducar
                      </p>
                      <p className="text-xs text-[#5C7B98]">
                        Lotes de temporada o productos con fecha límite
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.expiringEnabled}
                    onChange={(e) => void handlePrefChange({expiringEnabled: e.target.checked})}
                    className="h-5 w-5 accent-[#1F69FC]"
                  />
                </label>
              </div>

              {/* Días de anticipación */}
              {notificationPrefs.expiringEnabled && (
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5">
                  <p className="mb-2 text-xs font-semibold text-[#5C7B98]">
                    Avisar antes de caducar con:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 7, 15].map((days) => {
                      const active = notificationPrefs.expiryWarningDays === days;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => void handlePrefChange({expiryWarningDays: days})}
                          className={`min-h-[40px] rounded-full text-xs font-bold ${
                            active
                              ? 'bg-[#0A1F32] text-white'
                              : 'border border-slate-200 bg-white text-[#071C2D]'
                          }`}
                        >
                          {days} días
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {fcmTokens.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-[#E3F7EC] px-3.5 py-2.5 text-xs font-semibold text-[#15803D]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Token FCM guardado en tu cuenta de forma segura.</span>
                </div>
              )}

              <button
                type="button"
                disabled={testing || !supported}
                onClick={handleTest}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#1F69FC]/30 bg-[#E6EEFF] px-4 text-sm font-bold text-[#1F69FC] disabled:opacity-50"
              >
                <Smartphone className="h-4 w-4" />
                {testing ? 'Enviando prueba...' : 'Probar notificación en este dispositivo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
