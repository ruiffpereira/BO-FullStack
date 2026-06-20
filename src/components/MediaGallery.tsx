import { Button } from '../ui/ui.jsx'
import { uploadImage } from '../gen/backoffice/hooks/useUploadImage.js'
import { uploadVideo } from '../gen/backoffice/hooks/useUploadVideo.js'

export interface MediaItem {
  type: 'image' | 'video'
  url: string
  key?: string
  /** Ficheiro local ainda não enviado (upload diferido até "Guardar"). */
  file?: File
  /** true enquanto o ficheiro só existe localmente (preview blob:). */
  pending?: boolean
}

/**
 * Envia para o storage todos os itens pendentes (escolhidos pelo user mas ainda
 * não carregados) e devolve a lista final, limpa, pronta a guardar. Deve ser
 * chamado no handler de "Guardar" do formulário. Lança em caso de erro.
 */
export async function uploadPendingMedia(items: MediaItem[], module = 'gym'): Promise<MediaItem[]> {
  const out: MediaItem[] = []
  for (const m of items) {
    if (m.pending && m.file) {
      if (m.type === 'image') {
        const r = await uploadImage({ image: m.file, module } as any)
        out.push({ type: 'image', url: r.fileUrl, key: r.key })
      } else {
        const r = await uploadVideo({ file: m.file, module } as any)
        out.push({ type: 'video', url: r.fileUrl, key: r.key })
      }
      if (m.url.startsWith('blob:')) URL.revokeObjectURL(m.url)
    } else {
      out.push({ type: m.type, url: m.url, key: m.key })
    }
  }
  return out
}

/**
 * Galeria de media para um exercício. O upload NÃO acontece ao escolher o
 * ficheiro — só é segurado localmente (preview blob:) e enviado no "Guardar"
 * via `uploadPendingMedia`. Remover apenas tira da lista (não apaga do storage).
 */
export function MediaGallery({
  value,
  onChange,
}: {
  value: MediaItem[]
  onChange: (media: MediaItem[]) => void
  module?: string
}) {
  function pickFile(kind: 'image' | 'video') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = kind === 'image' ? 'image/*' : 'video/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      onChange([...value, { type: kind, url: URL.createObjectURL(file), file, pending: true }])
    }
    input.click()
  }

  const removeAt = (i: number) => {
    const m = value[i]
    if (m?.pending && m.url.startsWith('blob:')) URL.revokeObjectURL(m.url)
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Imagens / Vídeos</span>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="secondary" icon="image" onClick={() => pickFile('image')}>Imagem</Button>
          <Button type="button" size="sm" variant="secondary" icon="upload" onClick={() => pickFile('video')}>Vídeo</Button>
        </div>
      </div>

      {value.length === 0 ? (
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
              {m.pending && (
                <span className="absolute bottom-1 right-1 text-[9px] px-1 rounded bg-amber-500/90 text-white">por guardar</span>
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
        </div>
      )}
    </div>
  )
}
