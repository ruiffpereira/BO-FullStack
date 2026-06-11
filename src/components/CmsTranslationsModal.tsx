import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Modal, Button } from '../ui/ui.jsx'
import { LangFlag } from '../utils/langFlag'
import { useGetCmsEntries } from '../gen/backoffice/hooks/useGetCmsEntries.js'
import { putCmsEntries } from '../gen/backoffice/hooks/usePutCmsEntries.js'
import { useGetSettingsLanguages } from '../hooks/useSettingsLanguages'

const inputCls = 'w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100'

export function CmsTranslationsModal({
  cmsKey,
  defaultLang,
  onClose,
}: {
  cmsKey: string
  defaultLang: string
  onClose: () => void
}) {
  const { data: langData } = useGetSettingsLanguages()
  const activeLangs = (() => {
    const def = langData?.default ?? defaultLang
    const sel = langData?.selected ?? []
    return sel.includes(def) ? sel : [def, ...sel]
  })()

  const { data: allEntries = [], isLoading } = useGetCmsEntries()

  const existing: Record<string, string> = (allEntries as any[])
    .filter((e) => e.key === cmsKey && e.locale)
    .reduce((acc: Record<string, string>, e: any) => { acc[e.locale] = e.value; return acc }, {})

  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading) setTranslations(existing)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, cmsKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const lang of activeLangs) {
        const val = translations[lang]
        if (val?.trim()) {
          await putCmsEntries({ key: cmsKey, locale: lang, value: val.trim(), type: 'text' })
        }
      }
      toast.success('Traduções guardadas')
      onClose()
    } catch {
      toast.error('Erro ao guardar traduções')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Traduções"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <p className="text-xs text-zinc-400 font-mono mb-4">{cmsKey}</p>
      {isLoading ? (
        <p className="text-sm text-zinc-400 py-4 text-center">A carregar…</p>
      ) : (
        <div className="space-y-3">
          {activeLangs.map((lang) => (
            <div key={lang}>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                <LangFlag code={lang} className="h-3.5 w-auto rounded-sm" />
                {lang.toUpperCase()}
                {lang === defaultLang && <span className="text-amber-500 ml-0.5">★</span>}
              </label>
              <textarea
                value={translations[lang] ?? ''}
                onChange={(e) => setTranslations((t) => ({ ...t, [lang]: e.target.value }))}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="Tradução…"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
