import React from 'react';
import { Icon } from './icons.jsx';
import { Input, Button, IconButton } from './ui.jsx';

// ----------------------------------------------------------------------------
// Login — user + password, with quick role shortcuts for the demo
// ----------------------------------------------------------------------------
const { useState: useStateLogin } = React;

function Login({ onLogin, perfis, theme, onToggleTheme }) {
  const [user, setUser] = useStateLogin('');
  const [pass, setPass] = useStateLogin('');
  const [show, setShow] = useStateLogin(false);
  const [err, setErr] = useStateLogin('');
  const [loading, setLoading] = useStateLogin(false);

  const submit = (e) => {
    e.preventDefault();
    if (!user || !pass) { setErr('Introduz utilizador e palavra-passe.'); return; }
    setErr(''); setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(perfis.find((p) => p.id === 'super') || perfis[0]); }, 650);
  };

  const quick = (perfil) => { onLogin(perfil); };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      {/* Left brand panel (desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] xl:w-1/2 p-12 relative overflow-hidden" style={{ background: 'linear-gradient(155deg, #0b0b0c 0%, #18181b 60%, #1c2540 100%)' }}>
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, var(--accent-hex)33, transparent 70%)' }} />
        <div className="absolute right-10 bottom-10 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, var(--accent-hex)22, transparent 70%)' }} />
        <div className="relative flex items-center gap-2.5 text-white">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center"><Icon name="layers" className="w-5 h-5" /></div>
          <span className="font-semibold text-lg tracking-tight">Backoffice</span>
        </div>
        <div className="relative">
          <h2 className="text-white text-3xl xl:text-4xl font-semibold leading-tight tracking-tight max-w-md">Uma plataforma, vários negócios.</h2>
          <p className="text-zinc-400 mt-4 max-w-sm leading-relaxed">Gere barbearias e lojas online a partir do mesmo sítio. Cada conta vê apenas os componentes que a sua permissão autoriza.</p>
          <div className="flex gap-2 mt-8">
            {['Dashboard', 'Loja', 'Agenda', 'Admin'].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-[13px] backdrop-blur">{t}</span>
            ))}
          </div>
        </div>
        <p className="relative text-zinc-500 text-xs">© 2026 Backoffice · Protótipo</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-5">
          <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} onClick={onToggleTheme} label="Tema" />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white"><Icon name="layers" className="w-5 h-5" /></div>
              <span className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-white">Backoffice</span>
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Entrar</h1>
            <p className="text-sm text-zinc-500 mt-1.5">Bem-vindo de volta. Inicia sessão na tua conta.</p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <Input label="Utilizador" icon="user" placeholder="o-teu-utilizador" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Palavra-passe</span>
                  <a className="text-[13px] text-accent hover:underline" href="#" onClick={(e) => e.preventDefault()}>Esqueceste-te?</a>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="lock" className="w-[18px] h-[18px]" /></span>
                  <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 pl-10 pr-10 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><Icon name="eye" className="w-[18px] h-[18px]" /></button>
                </div>
              </div>
              {err && <p className="text-[13px] text-red-500 flex items-center gap-1.5"><Icon name="ban" className="w-4 h-4" />{err}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'A entrar…' : 'Entrar'}</Button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400">ou entra como (demo)</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {perfis.map((p) => (
                <button key={p.id} onClick={() => quick(p)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-accent hover:bg-accent/[0.03] transition text-left group">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: p.cor }}><Icon name="user" className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{p.nome}</span>
                    <span className="block text-xs text-zinc-400 truncate">{p.componentes.length} componentes</span>
                  </span>
                  <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 group-hover:text-accent ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Login };
