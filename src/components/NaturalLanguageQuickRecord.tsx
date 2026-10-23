'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { MoneyInput } from '@/components/ui/money-input';
import { Switch } from '@/components/ui/switch';
import { parseExpenseNaturalLanguage, ParsedExpense } from '@/lib/nlp-expense-parser';

interface NaturalLanguageQuickRecordProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRecord: (expense: { amount: number; description: string; category: string; currency: string }) => void;
  currencyCode?: string;
}

export function NaturalLanguageQuickRecord({
  isOpen,
  onOpenChange,
  onRecord,
  currencyCode = 'SGD',
}: NaturalLanguageQuickRecordProps) {
  const [inputText, setInputText] = useState('');
  const [useManualMoneyInput, setUseManualMoneyInput] = useState(false);
  const [manualAmountMinor, setManualAmountMinor] = useState<number | null>(null);
  const [manualDescription, setManualDescription] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode);
  const [isRecordedFlash, setIsRecordedFlash] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Parse natural language in real-time
  const parsed: ParsedExpense = parseExpenseNaturalLanguage(inputText, selectedCurrency);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      setInputText('');
      setManualDescription('');
      setManualAmountMinor(null);
      setIsRecordedFlash(false);
    }
  }, [isOpen]);

  // Gestural "Release to Record" Slider mechanics
  const dragX = useMotionValue(0);
  const sliderWidth = 240;
  const threshold = sliderWidth - 54;
  const sliderOpacity = useTransform(dragX, [0, threshold], [0.7, 1]);
  const sliderColor = useTransform(dragX, [0, threshold], ['#000000', '#000000']);

  function handleCommit() {
    let finalAmount = 0;
    let finalDesc = '';
    let finalCat = 'General';

    if (useManualMoneyInput) {
      finalAmount = (manualAmountMinor ?? 0) / 100;
      finalDesc = manualDescription.trim() || 'Gasto Manual';
      finalCat = 'General';
    } else {
      finalAmount = parsed.amount ?? 0;
      finalDesc = parsed.description || 'Gasto';
      finalCat = parsed.category || 'General';
    }

    if (finalAmount <= 0) return;

    setIsRecordedFlash(true);
    setTimeout(() => {
      onRecord({
        amount: finalAmount,
        description: finalDesc,
        category: finalCat,
        currency: selectedCurrency,
      });
      onOpenChange(false);
    }, 450);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  }

  const canCommit = useManualMoneyInput
    ? (manualAmountMinor ?? 0) > 0
    : (parsed.amount ?? 0) > 0;

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={onOpenChange}
      title="Registrar Gasto Rápido"
      description="Escribe con lenguaje natural o usa el teclado numérico de precisión."
      detents={[0.55, 0.92]}
      initialDetent={0}
    >
      <div className="space-y-6 pt-2 pb-8 max-w-md mx-auto text-black font-sans">
        {/* Toggle Mode: Just Type vs MoneyInput */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 border border-black/5">
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-black tracking-tight">
              Modo Entrada Libre (&quot;Just Type&quot;)
            </span>
            <span className="text-[11px] text-neutral-500">
              {useManualMoneyInput
                ? 'Usando MoneyInput de alta precisión'
                : 'Escribe ej: "6 coffee" o "12 uber"'}
            </span>
          </div>
          <Switch
            checked={!useManualMoneyInput}
            onCheckedChange={(checked) => setUseManualMoneyInput(!checked)}
          />
        </div>

        {/* Mode 1: Natural Language "Just Type" */}
        {!useManualMoneyInput ? (
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                Entrada en Lenguaje Natural
              </label>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ej. 6 coffee, 12 uber, 45 dinner..."
                className="w-full px-4 py-4 rounded-2xl bg-white border-2 border-black text-lg font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/20 placeholder:text-neutral-400 font-sans shadow-sm"
              />
            </div>

            {/* Live Parsing Feedbacks */}
            <AnimatePresence mode="wait">
              {inputText.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-4 rounded-2xl bg-neutral-50 border border-black/10 space-y-3"
                >
                  <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest">
                    Detección en Tiempo Real
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center text-lg">
                        {parsed.categoryIcon}
                      </div>
                      <div>
                        <div className="font-bold text-[15px] text-black">
                          {parsed.description || '...'}
                        </div>
                        <div className="text-[12px] text-neutral-500">
                          {parsed.category}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-black">
                        {parsed.amount !== null
                          ? `${parsed.currency} ${parsed.amount.toFixed(2)}`
                          : '--'}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {parsed.amount ? 'Monto identificado' : 'Ingresa un número'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Inspiration Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono uppercase text-neutral-400">
                Sugerencias rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['6 coffee', '12.50 uber', '45 dinner', '80 super', '15 netflix'].map(
                  (chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setInputText(chip)}
                      className="px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-black hover:text-white text-neutral-700 text-[11px] font-mono transition-all border border-black/5 cursor-pointer"
                    >
                      {chip}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Mode 2: Precision MoneyInput from UIARC */
          <div className="space-y-4">
            <MoneyInput
              label="Monto Exacto"
              currency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              currencies={['USD', 'SGD', 'EUR', 'GBP', 'VES']}
              onValueChange={(minor) => setManualAmountMinor(minor)}
              quickAdd={[5, 10, 25, 50]}
            />

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                Descripción o Concepto
              </label>
              <input
                type="text"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ej. Café con leche, Almuerzo, Uber..."
                className="w-full px-4 py-3 bg-white border border-black/20 rounded-xl text-base font-medium text-black focus:outline-none focus:border-black font-sans"
              />
            </div>
          </div>
        )}

        {/* Gestural "Release to Record" Slider */}
        <div className="pt-4 space-y-3">
          <div className="text-[11px] font-mono uppercase text-center text-neutral-400">
            Confirmación Gestual: Desliza y suelta
          </div>

          <div className="relative w-full h-14 rounded-full bg-neutral-100 border border-black/10 overflow-hidden flex items-center px-1.5 select-none touch-none">
            {/* Center label hint */}
            <motion.div
              style={{ opacity: sliderOpacity }}
              className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tracking-tight text-neutral-400 pointer-events-none uppercase font-mono"
            >
              {canCommit ? 'Desliza para registrar ➔' : 'Escribe un monto para activar'}
            </motion.div>

            {/* Draggable Knob */}
            <motion.div
              drag={canCommit ? 'x' : false}
              dragConstraints={{ left: 0, right: threshold }}
              dragElastic={0.05}
              style={{ x: dragX, backgroundColor: sliderColor }}
              onDragEnd={(_, info) => {
                if (info.offset.x >= threshold * 0.85) {
                  handleCommit();
                }
              }}
              whileTap={{ scale: 0.95 }}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold cursor-grab active:cursor-grabbing z-10 transition-colors ${
                canCommit
                  ? 'bg-black shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                  : 'bg-neutral-300 opacity-50 cursor-not-allowed'
              }`}
            >
              {isRecordedFlash ? '✓' : '➔'}
            </motion.div>
          </div>

          {/* Fallback One-Tap Record Button */}
          <button
            type="button"
            disabled={!canCommit || isRecordedFlash}
            onClick={handleCommit}
            className="w-full py-3.5 rounded-2xl bg-black text-white text-[14px] font-bold hover:bg-neutral-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-mono uppercase tracking-wider cursor-pointer shadow-sm"
          >
            {isRecordedFlash ? '✓ Registrado' : 'Registrar Inmediato (Enter)'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
