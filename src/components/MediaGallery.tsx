import { useState } from 'react'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Button } from '../ui/ui.jsx'
import { uploadImage } from '../gen/backoffice/hooks/useUploadImage.js'
import { uploadVideo } from '../gen/backoffice/hooks/useUploadVideo.js'

export interface MediaItem {
  type: 'image' | 'video'
  url: string
  key?: string
}

/**
 * Galeria de media para um exercício: carrega imagens (otimizadas) e vídeos
 * (até 100MB) para o storage e devolve a lista via onChange. Não apaga do
 * storage ao remover — só tira da lista.
 */
export function MediaGallery({
  value,
  onChange,
  module = 'gym',
}: {
  value: MediaItem[]
  onChange: (media: MediaItem[]) => void
  module?: string
}) {
  const [busy, setBusy] = useState(false)

  function pickAndUpload(kind: 'image' | 'video') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = kind === 'image' ? 'image/*' : 'video/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setBusy(true)
      try {
        if (kind === 'image') {
          const r = await uploadImage({ image: file, module } as any)
          onChange([...value, { type: 'image', url: r.fileUrl, key: r.key }])
        } else {
          const r = await uploadVideo({ file, module } as any)
          onChange([...value, { type: 'video', url: r.fileUrl, key: r.key }])
        }
      } catch (e) {
        toast.error(getApiError(e))
      } finally {
        setBusy(false)
      }
    }
    input.click()
  }

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Imagens / Vídeos</span>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="secondary" icon="image" disabled={busy} onClick={() => pickAndUpload('image')}>Imagem</Button>
          <Button type="button" size="sm" variant="secondary" icon="upload" disabled={busy} onClick={() => pickAndUpload('video')}>Vídeo</Button>
        </div>
      </div>

      {value.length === 0 && !busy ? (
        <p className="text-xs text-zinc-400 text-center py-3 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          Sem media. Adiciona imagens ou vídeos.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((m, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
              {m.type === 'image' ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={m.url} className="w-full h-full object-cover" muted playsInline />
              )}
              {m.type === 'video' && (
                <span className="absolute bottom-1 left-1 text-[9px] px-1 rounded bg-black/60 text-white">vídeo</span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-sm leading-none hover:bg-red-600"
                aria-label="Remover"
              >
                ×
              </button>
            </div>
          ))}
          {busy && (
            <div className="aspect-square rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-xs text-zinc-400">
              A carregar…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
