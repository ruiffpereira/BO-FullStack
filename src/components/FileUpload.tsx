import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api'

const ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  document: 'application/pdf',
  any: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
}

interface FileUploadProps {
  module: string
  accept?: 'image' | 'document' | 'any'
  currentUrl?: string | null
  onUploaded: (fileUrl: string, key: string) => void
  onDeleted?: () => void
  label?: string
  className?: string
}

export function FileUpload({
  module,
  accept = 'image',
  currentUrl,
  onUploaded,
  onDeleted,
  label = 'Carregar ficheiro',
  className = '',
}: FileUploadProps) {
  const { authHeader } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      // 1 — get presigned URL from API
      const presignRes = await fetch(`${API_BASE}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ filename: file.name, contentType: file.type, module }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao obter URL de upload')
      }
      const { uploadUrl, fileUrl, key } = await presignRes.json()

      // 2 — upload directly to MinIO using the presigned PUT URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Erro ao enviar ficheiro')

      if (accept === 'image' || file.type.startsWith('image/')) {
        setPreview(fileUrl)
      }
      onUploaded(fileUrl, key)
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
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDelete = async () => {
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
          <button
            type="button"
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
          >
            <Icon name="x" className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-accent hover:bg-accent/5 transition"
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
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  )
}
