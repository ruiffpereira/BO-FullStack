import { useDropzone } from 'react-dropzone'
import { useState } from 'react'

export type FileWithPreview = {
  name: string
  preview: string
  size: number
}

type UseImageUploaderProps = FileWithPreview[] | undefined

type ReturnUseImageUploaderProps = {
  files: FileWithPreview[]
  setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>
  getRootProps: () => {}
  getInputProps: () => {}
  isDragActive: boolean
}

export function useImageUploader(
  data?: UseImageUploaderProps,
): ReturnUseImageUploaderProps {
  const [files, setFiles] = useState<FileWithPreview[]>(data ? data : [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles((prevState) => {
        const newFiles = acceptedFiles.filter(
          (file) =>
            !prevState.some(
              (existingFile) =>
                existingFile.name === file.name &&
                existingFile.size === file.size,
            ),
        )

        return [
          ...prevState,
          ...newFiles.map((file) =>
            Object.assign(file, {
              preview: URL.createObjectURL(file),
            }),
          ),
        ]
      })
    },
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
    },
  })

  return {
    files,
    setFiles,
    getRootProps,
    getInputProps,
    isDragActive,
  }
}
