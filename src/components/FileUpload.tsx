import { useRef, useState } from 'react'
import { Icon } from '../ui/icons.jsx'
import { uploadImage } from '../gen/backoffice/hooks/useUploadImage.js'

const ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp',
  document: 'application/pdf',
  any: 'image/jpeg,image/png,image/webp,application/pdf',
}

interface FileUploadProps {
  module: string
  accept?: 'image' | 'document' | 'any'
  currentUrl?: string | null
  /** Não usado em modo `deferred` (nada é enviado ao escolher o ficheiro). */
  onUploaded?: (fileUrl: string, key: string) => void
  onDeleted?: () => void
  label?: string
  className?: string
  disabled?: boolean
  /**
   * Modo diferido: NÃO envia já para o storage — só mostra a pré-visualização
   * local (`blob:`) e devolve o `File` via `onFileSelected`. Quem usa fica
   * responsável por chamar `uploadImage` mais tarde (ex.: ao Guardar o
   * formulário) — evita ficheiros órfãos se o formulário for cancelado.
   */
  deferred?: boolean
  /** Só em modo `deferred`. `null` = cancelar a escolha pendente (volta ao `currentUrl`). */
  onFileSelected?: (file: File | null) => void
}

export function FileUpload({
  module,
  accept = 'image',
  currentUrl,
  onUploaded,
  onDeleted,
  label = 'Carregar ficheiro',
  className = '',
  disabled = false,
  deferred = false,
  onFileSelected,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [pendingLocal, setPendingLocal] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('O upload optimizado suporta apenas imagens')
      return
    }

    if (deferred) {
      const blobUrl = URL.createObjectURL(file)
      setPreview(blobUrl)
      setPendingLocal(true)
      onFileSelected?.(file)
      return
    }

    setUploading(true)
    try {
      const { fileUrl, key } = await uploadImage({
        image: file,
        module,
      })

      setPreview(fileUrl)
      onUploaded?.(fileUrl, key)
    } catch (err: any) {
      setError(err.message ?? 'Erro desconhecido')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled || uploading) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDelete = async () => {
    if (deferred && pendingLocal) {
      // Cancela a escolha pendente (ainda não enviada) — volta ao valor persistido.
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(currentUrl ?? null)
      setPendingLocal(false)
      onFileSelected?.(null)
      return
    }
    setPreview(null)
    onDeleted?.()
  }

  const isImage = accept === 'image' || (preview && !preview.endsWith('.pdf'))

  return (
    <div className={`space-y-2 ${className}`}>
      {preview ? (
        <div className="relative inline-block">
          {isImage ? (
            <img
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700"
            />
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
              <Icon name="layers" className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-600 dark:text-zinc-300 truncate max-w-[140px]">
                {preview.split('/').pop()}
              </span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-xl bg-black/55 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading || disabled}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
          >
            <Icon name="x" className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          aria-disabled={disabled}
          className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-accent hover:bg-accent/5'}`}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Icon name="upload" className="w-6 h-6 text-zinc-400" />
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="text-xs text-zinc-400">Ou arrasta aqui</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[accept]}
        disabled={uploading || disabled}
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  )
}
