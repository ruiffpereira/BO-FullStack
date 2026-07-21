import React from 'react';
import { Icon } from './icons.jsx';

// ----------------------------------------------------------------------------
// Shared UI primitives — minimal/clean, light & dark aware
// ----------------------------------------------------------------------------
const { useState: useStateUI, useEffect: useEffectUI, useRef: useRefUI } = React;

function Card({ children, className = '', ...rest }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Button({ children, variant = 'primary', size = 'md', icon, isLoading = false, disabled, className = '', ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const sizes = { sm: 'text-[13px] px-2.5 py-1.5', md: 'text-sm px-3.5 py-2', lg: 'text-[15px] px-5 py-2.5' };
  const variants = {
    primary: 'bg-accent text-white hover:brightness-110 shadow-sm shadow-accent/20',
    secondary: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700',
    outline: 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  };
  const iconCls = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={isLoading || disabled} {...rest}>
      {isLoading
        ? <Icon name="loader" className={`${iconCls} animate-spin`} />
        : icon
          ? <Icon name={icon} className={iconCls} />
          : null}
      {children}
    </button>
  );
}

function IconButton({ icon, className = '', label, ...rest }) {
  return (
    <button aria-label={label} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors ${className}`} {...rest}>
      <Icon name={icon} className="w-[18px] h-[18px]" />
    </button>
  );
}

const BADGE_TONES = {
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

function Input({ label, icon, className = '', hint, type = 'text', ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name={icon} className="w-[18px] h-[18px]" /></span>}
        <input type={type} className={`w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 ${icon ? 'pl-10' : ''} focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition ${className}`} {...rest} />
      </div>
      {hint && <span className="block text-xs text-zinc-400 mt-1">{hint}</span>}
    </label>
  );
}

function Select({ label, children, className = '', ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>}
      <div className="relative">
        <select className={`w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 pr-9 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition ${className}`} {...rest}>
          {children}
        </select>
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Icon name="chevronDown" className="w-4 h-4" /></span>
      </div>
    </label>
  );
}

function Toggle({ checked, onChange, size = 'md', disabled = false, label }) {
  // Track com padding fixo + knob centrado por flexbox; só translateX no knob.
  const d = size === 'sm'
    ? { track: 'w-9 h-5', knob: 'h-4 w-4', on: 'translate-x-4' }
    : { track: 'w-11 h-6', knob: 'h-5 w-5', on: 'translate-x-5' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${d.track} inline-flex items-center rounded-full p-0.5 shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-600'}`}
    >
      <span className={`${d.knob} rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${checked ? d.on : 'translate-x-0'}`} />
    </button>
  );
}

function Avatar({ name, color = '#2A6FDB', size = 36 }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

// ── Modal stack: gerencia Esc e focus quando múltiplos modais estão abertos ──
const modalStack = [];
let modalSeq = 0;

function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  const modalIdRef = useRefUI(null);
  const panelRef = useRefUI(null);
  const savedActiveElementRef = useRefUI(null);

  // Gera um ID único para este modal ao montar (open -> true).
  if (open && !modalIdRef.current) {
    modalIdRef.current = `modal-${++modalSeq}`;
  }

  useEffectUI(() => {
    if (!open || !modalIdRef.current) return;

    const modalId = modalIdRef.current;

    // 1. Guarda o elemento ativo do DOM (para restaurar no close).
    savedActiveElementRef.current = document.activeElement;

    // 2. Adiciona o modal à stack.
    modalStack.push(modalId);

    // 3. Focus no painel do modal.
    if (panelRef.current) {
      panelRef.current.focus();
    }

    // 4. Handler de keydown: só o modal do topo reage.
    const handleKeyDown = (e) => {
      if (modalStack[modalStack.length - 1] !== modalId) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        trapTabFocus(e, panelRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const idx = modalStack.indexOf(modalId);
      if (idx !== -1) modalStack.splice(idx, 1);
      // Restaura o foco ao elemento que estava ativo antes (se ainda existe no DOM).
      if (savedActiveElementRef.current && document.contains(savedActiveElementRef.current)) {
        savedActiveElementRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] animate-[fade_.15s_ease]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full ${width} rounded-t-2xl sm:rounded-2xl shadow-xl animate-[pop_.18s_cubic-bezier(.2,.8,.2,1)] max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <IconButton icon="x" onClick={onClose} label="Fechar" className="-mr-2 -mt-1" />
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

// Helper: trap Tab (cicla dentro do modal)
function trapTabFocus(e, panel) {
  if (e.key !== 'Tab' || !panel) return;
  const focusables = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// Striped image placeholder (per design guidance — no fake imagery)
function ImgPlaceholder({ label = 'imagem', className = '', tint = '#2A6FDB', rounded = 'rounded-lg' }) {
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: `repeating-linear-gradient(135deg, ${tint}14, ${tint}14 8px, ${tint}08 8px, ${tint}08 16px)` }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-white/70 dark:bg-zinc-900/70 px-1.5 py-0.5 rounded">{label}</span>
      </div>
    </div>
  );
}

// Segmented pill tabs — the canonical way to switch sections across the app.
// tabs: [{ id, label, icon? }]. Keyboard: ←/→ move between tabs.
function Tabs({ tabs, value, onChange, fullWidth = false, size = 'md', className = '' }) {
  const onKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === value);
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    onChange(tabs[(i + dir + tabs.length) % tabs.length].id);
  };
  const pad = size === 'sm' ? 'px-3 py-1.5' : 'px-3.5 py-2';
  return (
    <div role="tablist" onKeyDown={onKey}
      className={`flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 overflow-x-auto ${fullWidth ? 'w-full' : 'w-full sm:w-auto sm:inline-flex'} ${className}`}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-1.5 ${pad} rounded-lg text-sm font-medium whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${fullWidth ? 'flex-1 justify-center' : ''} ${active ? 'bg-white dark:bg-zinc-900 text-accent shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            {t.icon && <Icon name={t.icon} className="w-4 h-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Eyebrow heading for sections inside a Card. Optional `right` slot for a count/action.
function SectionTitle({ children, right, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-2 mb-3 ${className}`}>
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{children}</h2>
      {right}
    </div>
  );
}

// Barra de ações do topo da página (título/subtítulo já vivem no topbar do
// Shell — ver `resolveTopbarTitle` + `usePageSubtitle`, `PageMetaContext`).
// Sem ações não há nada a mostrar: devolve `null` para não deixar um espaço
// vazio entre o topbar e o conteúdo da página.
function PageHeader({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap mb-6">
      {children}
    </div>
  );
}

function EmptyState({ icon = 'box', title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4"><Icon name={icon} className="w-6 h-6" /></div>
      <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
      {desc && <p className="text-sm text-zinc-500 mt-1 max-w-xs">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { Card, Button, IconButton, Badge, Input, Select, Toggle, Avatar, Modal, ImgPlaceholder, PageHeader, EmptyState, Tabs, SectionTitle, BADGE_TONES };
