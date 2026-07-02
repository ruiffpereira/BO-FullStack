import { useState } from 'react'
import { Icon } from '../ui/icons.jsx'
import { Button, Input } from '../ui/ui.jsx'
import { API_BASE } from '../lib/env'

export function SetupPassword({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') ?? ''
  const isReset = params.get('reset') === '1'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rules = [
    { label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: 'Número', ok: /[0-9]/.test(password) },
  ]
  const strong = rules.every((r) => r.ok)
  const matches = password === confirm && confirm.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!strong) { setError('A password não cumpre os requisitos'); return }
    if (!matches) { setError('As passwords não coincidem'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/users/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="absolute top-4 right-4">
        <button onClick={onToggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white">
            <Icon name="layers" className="w-5 h-5" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
          {!token ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto">
                <Icon name="ban" className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Link inválido</h2>
              <p className="text-sm text-zinc-500">Este link não é válido. Peça ao administrador para enviar um novo email.</p>
            </div>
          ) : done ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Icon name="check" className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Password definida!</h2>
              <p className="text-sm text-zinc-500">Pode agora entrar com a sua conta.</p>
              <Button className="w-full mt-2" onClick={() => { window.location.href = '/' }}>
                Ir para o login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  {isReset ? 'Redefinir password' : 'Criar password'}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {isReset
                    ? 'Introduza a sua nova palavra-passe.'
                    : 'Configure a sua palavra-passe de acesso ao backoffice.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nova password
                  </label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null) }}
                      placeholder="••••••••"
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-accent"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShow((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                      <Icon name={show ? 'eye' : 'lock'} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {password.length > 0 && (
                  <div className="space-y-1.5">
                    {rules.map((r) => (
                      <div key={r.label} className={`flex items-center gap-2 text-xs ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                        <Icon name={r.ok ? 'check' : 'x'} className="w-3.5 h-3.5 shrink-0" />
                        {r.label}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Confirmar password
                  </label>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                    placeholder="••••••••"
                    className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none ${confirm.length > 0 ? (matches ? 'border-emerald-400 focus:border-emerald-400' : 'border-red-400 focus:border-red-400') : 'border-zinc-200 dark:border-zinc-700 focus:border-accent'}`}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading || !strong || !matches}>
                  {loading ? 'A guardar…' : isReset ? 'Redefinir password' : 'Definir password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
