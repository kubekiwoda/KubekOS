/**
 * KubekOS Calculator Application
 * Safe, deterministic arithmetic evaluator (no eval/Function), keyboard support, and history tape.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Delete, History, RotateCcw } from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

export function evaluateArithmeticExpression(expr: string): number {
  const sanitized = expr.replace(/\s+/g, '');
  if (!sanitized) return 0;

  // Tokenize numbers and operators (+, -, *, /, %)
  const tokens: (number | string)[] = [];
  let i = 0;

  while (i < sanitized.length) {
    const ch = sanitized[i];
    if (
      (ch !== undefined && ch >= '0' && ch <= '9') ||
      ch === '.' ||
      (ch === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string'))
    ) {
      let numStr = ch;
      i += 1;
      while (
        i < sanitized.length &&
        ((sanitized[i]! >= '0' && sanitized[i]! <= '9') || sanitized[i] === '.')
      ) {
        numStr += sanitized[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) throw new Error('Invalid number');
      tokens.push(parsed);
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push(ch);
      i += 1;
    } else {
      throw new Error(`Unsupported token: ${ch}`);
    }
  }

  // First pass: *, /, %
  const pass1: (number | string)[] = [];
  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx];
    if (token === '*' || token === '/' || token === '%') {
      const prev = pass1.pop();
      const next = tokens[idx + 1];
      if (typeof prev !== 'number' || typeof next !== 'number') {
        throw new Error('Syntax error');
      }
      if ((token === '/' || token === '%') && next === 0) {
        throw new Error('Division by zero');
      }
      const res =
        token === '*' ? prev * next : token === '/' ? prev / next : prev % next;
      pass1.push(res);
      idx += 2;
    } else {
      if (token !== undefined) pass1.push(token);
      idx += 1;
    }
  }

  // Second pass: +, -
  let result = typeof pass1[0] === 'number' ? pass1[0] : 0;
  let j = 1;
  while (j < pass1.length) {
    const op = pass1[j];
    const val = pass1[j + 1];
    if (typeof val !== 'number') throw new Error('Syntax error');
    if (op === '+') result += val;
    if (op === '-') result -= val;
    j += 2;
  }

  return Math.round(result * 1e10) / 1e10;
}

export const CalculatorApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);

  const handleInput = useCallback(
    (char: string) => {
      setDisplay((prev) => {
        if (prev === '0' || prev === 'Error') {
          return ['+', '*', '/', '%'].includes(char) ? `0${char}` : char;
        }
        return prev + char;
      });
    },
    []
  );

  const handleClear = useCallback(() => setDisplay('0'), []);

  const handleBackspace = useCallback(() => {
    setDisplay((prev) => (prev.length <= 1 || prev === 'Error' ? '0' : prev.slice(0, -1)));
  }, []);

  const handleEquals = useCallback(() => {
    try {
      const value = evaluateArithmeticExpression(display);
      const resStr = String(value);
      setHistory((prev) => [{ expr: display, result: resStr }, ...prev.slice(0, 14)]);
      setDisplay(resStr);
    } catch {
      setDisplay('Error');
    }
  }, [display]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleInput(e.key);
      else if (['+', '-', '*', '/', '.', '%'].includes(e.key)) handleInput(e.key);
      else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleInput, handleEquals, handleBackspace, handleClear]);

  const buttons = [
    ['C', '%', '/', '⌫'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  return (
    <div data-testid="app-calculator" className="h-full flex flex-col p-4 gap-3 select-none">
      {/* Display Readout */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 text-right space-y-1">
        <div className="text-[11px] font-mono text-slate-400 h-4 truncate">
          {history[0] ? `${history[0].expr} = ${history[0].result}` : 'Ready'}
        </div>
        <div
          data-testid="calculator-display"
          className="text-3xl font-light font-mono text-white truncate"
        >
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        {buttons.flat().map((btn) => {
          const isEquals = btn === '=';
          const isOp = ['/', '*', '-', '+', '%'].includes(btn);

          return (
            <button
              key={btn}
              type="button"
              data-testid={`calc-btn-${btn}`}
              onClick={() => {
                if (btn === 'C') handleClear();
                else if (btn === '⌫') handleBackspace();
                else if (btn === '=') handleEquals();
                else handleInput(btn);
              }}
              className={`rounded-xl font-medium text-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                btn === '0' ? 'col-span-2' : ''
              } ${
                isEquals
                  ? `${accent.bgClass} text-slate-950 font-semibold`
                  : isOp
                    ? `${accent.subtleBgClass} ${accent.textClass} border ${accent.borderClass}`
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800'
              }`}
            >
              {btn === '⌫' ? <Delete className="w-4 h-4" /> : btn}
            </button>
          );
        })}
      </div>

      {/* History Tape */}
      {history.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-2.5 max-h-24 overflow-y-auto text-[11px] font-mono">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <History className="w-3 h-3" /> History
            </span>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-slate-300 py-0.5">
              <span>{h.expr}</span>
              <span className={accent.textClass}>= {h.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
