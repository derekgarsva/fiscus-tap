'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '@/types';
import { saveUserProfile, resetWallet } from '@/lib/wallet-store';
import { getBankByCode } from '@/config/banks';
import {
  modalBackdropVariants,
  bottomSheetVariants,
  bottomSheetDragProps,
  createDragEndHandler,
} from '@/lib/motion-config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onProfileUpdated: (updatedUser: UserProfile) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'app' | 'support'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [docNum, setDocNum] = useState(user.document_number);
  const [docType, setDocType] = useState(user.document_type || 'V');

  // App settings state
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const defaultBank = getBankByCode(user.default_bank);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      name,
      phone,
      document_number: docNum,
      document_type: docType,
    };
    await saveUserProfile(updated);
    onProfileUpdated(updated);
    setIsEditing(false);
  }

  function handleResetAll() {
    if (confirm('¿Seguro que deseas reiniciar todos los datos locales de Fiscus Tap?')) {
      resetWallet();
      window.location.reload();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-backdrop"
          variants={modalBackdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="settings-sheet"
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            {...bottomSheetDragProps}
            onDragEnd={createDragEndHandler(onClose)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#fbfbfd] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-black/[0.08] max-h-[90vh] flex flex-col overflow-hidden pb-safe"
          >
            {/* Top Drag Handle */}
            <div className="w-full pt-3 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-black/20" />
            </div>

            {/* Header */}
            <div className="p-5 pb-3 border-b border-black/[0.06] bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/[0.05] border border-black/[0.06] flex items-center justify-center text-base font-bold text-[#1d1d1f]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1d1d1f] leading-tight">
                      {user.name}
                    </h2>
                    <span className="text-[12px] text-[#86868b]">
                      {defaultBank?.name || 'Fiscus Tap'}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-black/[0.05] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                >
                  ✕
                </motion.button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 mt-4 p-1 bg-[#f5f5f7] rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    activeTab === 'profile'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Perfil
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('app')}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    activeTab === 'app'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Ajustes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('support')}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    activeTab === 'support'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Ayuda
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-[14px]">
              {/* TAB 1: PERFIL */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  {!isEditing ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-black/[0.04]">
                          <span className="text-[#86868b] text-[13px]">Nombre completo</span>
                          <span className="font-semibold text-[#1d1d1f]">{user.name}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-black/[0.04]">
                          <span className="text-[#86868b] text-[13px]">Documento de identidad</span>
                          <span className="font-mono text-[#1d1d1f]">
                            {user.document_type}-{user.document_number}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-black/[0.04]">
                          <span className="text-[#86868b] text-[13px]">Teléfono de Pago Móvil</span>
                          <span className="font-mono text-[#1d1d1f]">{user.phone}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#86868b] text-[13px]">Banco Predeterminado</span>
                          <span className="font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: defaultBank?.color || '#00A651' }}
                            />
                            {defaultBank?.name || 'Banesco'}
                          </span>
                        </div>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="w-full py-3 rounded-2xl border border-black/[0.08] text-[14px] font-medium text-[#0071e3] hover:bg-black/[0.02] transition-colors"
                      >
                        Editar Datos Personales
                      </motion.button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveProfile} className="space-y-3 bg-white p-4 rounded-2xl border border-black/[0.06]">
                      <div>
                        <label className="block text-[12px] font-medium text-[#86868b] mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[12px] font-medium text-[#86868b] mb-1">
                            Tipo
                          </label>
                          <select
                            value={docType}
                            onChange={(e) => setDocType(e.target.value as 'V' | 'E' | 'J' | 'P')}
                            className="w-full px-2 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm"
                          >
                            <option value="V">V</option>
                            <option value="E">E</option>
                            <option value="J">J</option>
                            <option value="P">P</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[12px] font-medium text-[#86868b] mb-1">
                            Cédula / RIF
                          </label>
                          <input
                            type="text"
                            required
                            value={docNum}
                            onChange={(e) => setDocNum(e.target.value)}
                            className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-[#86868b] mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-2 rounded-xl border border-black/[0.08] text-[13px] font-medium text-[#86868b]"
                        >
                          Cancelar
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="submit"
                          className="flex-1 py-2 rounded-xl bg-[#0071e3] text-white text-[13px] font-medium"
                        >
                          Guardar
                        </motion.button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: AJUSTES DE LA APP */}
              {activeTab === 'app' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#1d1d1f]">Vibración Háptica</div>
                        <div className="text-[12px] text-[#86868b]">
                          Vibrar al detectar terminal NFC
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hapticEnabled}
                        onChange={(e) => setHapticEnabled(e.target.checked)}
                        className="w-5 h-5 accent-[#0071e3] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
                      <div>
                        <div className="font-medium text-[#1d1d1f]">Sonido de Pago</div>
                        <div className="text-[12px] text-[#86868b]">
                          Tono de confirmación bancaria
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="w-5 h-5 accent-[#0071e3] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
                      <div>
                        <div className="font-medium text-[#1d1d1f]">Hardware NFC / HCE</div>
                        <div className="text-[12px] text-[#86868b]">
                          Emulación ISO 7816-4 Tipo 4
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                        Activo
                      </span>
                    </div>
                  </div>

                  {/* Descargar APK Android */}
                  <div className="pt-2">
                    <a
                      href="/apkportal"
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar APK Nativo para Android
                    </a>
                  </div>

                  {/* Reset wallet */}
                  <div className="pt-1">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={handleResetAll}
                      className="w-full py-3 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-[13px] font-medium transition-colors"
                    >
                      Reiniciar Datos de la Billetera (Modo Pruebas)
                    </motion.button>
                  </div>
                </div>
              )}

              {/* TAB 3: AYUDA Y SOPORTE */}
              {activeTab === 'support' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-1.5">
                      <h3 className="font-semibold text-[#1d1d1f] text-[14px]">
                        ¿Cómo funciona el pago de teléfono a teléfono?
                      </h3>
                      <p className="text-[12px] text-[#86868b] leading-relaxed">
                        Un teléfono actúa como terminal de cobro (HCE) y el otro como lector de tarjeta. Al juntar la parte trasera de ambos dispositivos, la sesión se transfiere por radiofrecuencia en menos de 1 segundo sin necesidad de códigos QR ni cámaras.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-1.5">
                      <h3 className="font-semibold text-[#1d1d1f] text-[14px]">
                        ¿Qué bancos son soportados?
                      </h3>
                      <p className="text-[12px] text-[#86868b] leading-relaxed">
                        Fiscus Tap está diseñado para la red interbancaria de Venezuela: Banco de Venezuela (BDV), Banesco, Banco Mercantil y BBVA Provincial bajo el estándar SUDEBAN C2P.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-2">
                      <h3 className="font-semibold text-[#1d1d1f] text-[14px]">
                        Contacto de Asistencia y Alianzas
                      </h3>
                      <div className="text-[12px] text-[#86868b] space-y-1">
                        <div>
                          <span className="font-medium text-[#1d1d1f]">Email:</span>{' '}
                          <a href="mailto:soporte@fiscus.app" className="text-[#0071e3] hover:underline">
                            soporte@fiscus.app
                          </a>
                        </div>
                        <div>
                          <span className="font-medium text-[#1d1d1f]">Fundador:</span> Derek Garsva
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer info */}
            <div className="p-4 border-t border-black/[0.06] bg-white text-center">
              <span className="text-[11px] text-[#86868b]">
                Fiscus Tap v0.1.0 MVP · Infraestructura de Pago Físico NFC
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
