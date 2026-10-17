'use client';

import { useState, useEffect } from 'react';
import { SUPPORTED_BANKS, getBankByCode } from '@/config/banks';
import { BankProfile, UserProfile } from '@/types';
import { getProfile, saveProfile, listProfiles } from '@/lib/profile-manager';
import { saveUserProfile } from '@/lib/wallet-store';

interface BankCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onProfileUpdated: (updatedUser: UserProfile) => void;
}

export function BankCardsModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: BankCardsModalProps) {
  const [profiles, setProfiles] = useState<Record<string, BankProfile>>({});
  const [editingBankCode, setEditingBankCode] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    phone: string;
    document_type: 'V' | 'E' | 'J' | 'P';
    document_number: string;
    holder_name: string;
  }>({
    phone: '',
    document_type: 'V',
    document_number: '',
    holder_name: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAllProfiles();
    }
  }, [isOpen]);

  async function loadAllProfiles() {
    try {
      const all = await listProfiles();
      setProfiles(all);
    } catch {
      setProfiles({});
    }
  }

  function handleStartEditing(bankCode: string) {
    const existing = profiles[bankCode];
    setFormData({
      phone: existing?.phone || currentUser.phone || '',
      document_type: existing?.document_type || currentUser.document_type || 'V',
      document_number: existing?.document_number || currentUser.document_number || '',
      holder_name: existing?.holder_name || currentUser.name || '',
    });
    setEditingBankCode(bankCode);
  }

  async function handleSaveBankDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBankCode) return;
    setIsSaving(true);

    try {
      const updatedProfile: BankProfile = {
        bank_code: editingBankCode,
        phone: formData.phone,
        document_type: formData.document_type,
        document_number: formData.document_number,
        holder_name: formData.holder_name,
        created_at: profiles[editingBankCode]?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveProfile(editingBankCode, updatedProfile);
      await loadAllProfiles();

      // If user is editing their current default bank, sync user profile
      if (currentUser.default_bank === editingBankCode) {
        const newUser: UserProfile = {
          ...currentUser,
          phone: formData.phone,
          document_type: formData.document_type,
          document_number: formData.document_number,
          name: formData.holder_name || currentUser.name,
        };
        await saveUserProfile(newUser);
        onProfileUpdated(newUser);
      }

      setEditingBankCode(null);
    } catch (err) {
      console.error('Error saving bank profile:', err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetAsDefault(bankCode: string) {
    try {
      const existing = profiles[bankCode];
      const newUser: UserProfile = {
        ...currentUser,
        default_bank: bankCode,
        ...(existing?.phone ? { phone: existing.phone } : {}),
        ...(existing?.document_number ? { document_number: existing.document_number } : {}),
        ...(existing?.document_type ? { document_type: existing.document_type } : {}),
      };
      await saveUserProfile(newUser);
      onProfileUpdated(newUser);
    } catch (err) {
      console.error('Error setting default bank:', err);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#fbfbfd] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-black/[0.08] max-h-[90vh] flex flex-col overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-black/[0.06] bg-white">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">
              Mis Cuentas y Tarjetas
            </h2>
            <p className="text-[12px] text-[#86868b]">
              Bancos asociados para cobrar y pagar con NFC
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {SUPPORTED_BANKS.map((bank) => {
            const profile = profiles[bank.code];
            const isDefault = currentUser.default_bank === bank.code;
            const isEditing = editingBankCode === bank.code;

            return (
              <div
                key={bank.code}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isDefault
                    ? 'border-[#0071e3] shadow-[0_4px_20px_rgba(0,113,227,0.12)] bg-white'
                    : 'border-black/[0.06] bg-white hover:border-black/[0.12]'
                }`}
              >
                {/* Bank Card Banner */}
                <div
                  className="p-4 text-white flex items-center justify-between"
                  style={{
                    background: `linear-gradient(135deg, ${bank.color} 0%, ${bank.color}dd 100%)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold text-lg shadow-inner">
                      {bank.short_name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-[15px] tracking-tight">
                        {bank.name}
                      </div>
                      <div className="text-[11px] text-white/80">
                        {profile ? `Pago Móvil · ${profile.phone}` : 'No vinculado'}
                      </div>
                    </div>
                  </div>

                  {isDefault && (
                    <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Activo
                    </span>
                  )}
                </div>

                {/* Card Body & Actions */}
                <div className="p-4 space-y-3">
                  {!isEditing ? (
                    <div className="flex items-center justify-between text-[13px]">
                      <div>
                        {profile ? (
                          <div className="space-y-0.5">
                            <span className="text-[#1d1d1f] font-medium block">
                              {profile.holder_name || currentUser.name}
                            </span>
                            <span className="text-[#86868b] text-[12px]">
                              {profile.document_type}-{profile.document_number} · {profile.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#ff9500] text-[12px] font-medium flex items-center gap-1">
                            <span>⚠</span> Datos sin completar
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEditing(bank.code)}
                          className="px-3 py-1.5 rounded-xl border border-black/[0.08] text-[12px] font-medium text-[#1d1d1f] hover:bg-black/[0.03] transition-colors"
                        >
                          {profile ? 'Editar' : 'Completar'}
                        </button>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetAsDefault(bank.code)}
                            className="px-3 py-1.5 rounded-xl bg-[#1d1d1f] text-white text-[12px] font-medium hover:bg-black active:scale-[0.98] transition-all"
                          >
                            Usar
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* In-line Edit Form */
                    <form onSubmit={handleSaveBankDetails} className="space-y-3 pt-1">
                      <div className="text-[12px] font-semibold uppercase tracking-wider text-[#86868b]">
                        Datos de Pago Móvil ({bank.short_name})
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                          Nombre del Titular
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.holder_name}
                          onChange={(e) => setFormData({ ...formData, holder_name: e.target.value })}
                          placeholder="Ej: Derek Garsva"
                          className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                            Tipo
                          </label>
                          <select
                            value={formData.document_type}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                document_type: e.target.value as 'V' | 'E' | 'J' | 'P',
                              })
                            }
                            className="w-full px-2 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                          >
                            <option value="V">V - Venezolano</option>
                            <option value="E">E - Extranjero</option>
                            <option value="J">J - Jurídico</option>
                            <option value="P">P - Pasaporte</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                            Número de Cédula / RIF
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.document_number}
                            onChange={(e) =>
                              setFormData({ ...formData, document_number: e.target.value })
                            }
                            placeholder="12345678"
                            className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                          Teléfono de Pago Móvil
                        </label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="04121234567"
                          className="w-full px-3 py-2 bg-[#f5f5f7] border border-black/[0.06] rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingBankCode(null)}
                          className="flex-1 py-2 rounded-xl border border-black/[0.08] text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 py-2 rounded-xl bg-[#0071e3] text-white text-[13px] font-medium hover:bg-[#0077ed] transition-colors"
                        >
                          {isSaving ? 'Guardando...' : 'Guardar Datos'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/[0.06] bg-white text-center">
          <p className="text-[11px] text-[#86868b]">
            Tus datos bancarios se guardan cifrados localmente mediante AES-GCM (Web Crypto API).
          </p>
        </div>
      </div>
    </div>
  );
}
