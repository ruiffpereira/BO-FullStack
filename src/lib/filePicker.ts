type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<Array<{ getFile: () => Promise<File> }>>
}

export function supportsFilePicker() {
  return typeof (window as FilePickerWindow).showOpenFilePicker === 'function'
}

export async function pickImageFile() {
  const picker = (window as FilePickerWindow).showOpenFilePicker
  if (!picker) return undefined

  try {
    const [handle] = await picker({
      multiple: false,
      types: [{
        description: 'Imagens',
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
      }],
    })
    return await handle?.getFile()
  } catch (e: any) {
    if (e?.name === 'AbortError') return null
    throw e
  }
}
