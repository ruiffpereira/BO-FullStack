'use client'

import z, { set, string } from 'zod'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { useGetCategories } from '@/server/backoffice/hooks/useGetCategories'
import { PostProductsMutationRequest } from '@/server/backoffice/types/PostProducts'
import {
  postProductsMutationKey,
  usePostProducts,
} from '@/server/backoffice/hooks/usePostProducts'
import { Session } from 'next-auth'
import { useImageUploader } from '@/components/product/image-uploader'
import SelectComponent, { SelectComponentRef } from './combobox'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

type FileWithPreview = {
  name: string
  preview: string
  size: number
}
  type ReturnUseImageUploaderProps = {
    value: FileWithPreview[]
    setvalue: React.Dispatch<React.SetStateAction<FileWithPreview[]>>
    getRootProps: () => {}
    getInputProps: () => {}
    isDragActive: boolean
  }

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  photos: z
    .array(z.any())
    .min(1, 'Imagem do produto é obrigatória').optional(),
  reference: z.string().optional(),
  stock: z
    .number()
    .min(0, 'Quantidade em estoque deve ser maior ou igual a zero'),
  price: z.number().min(0, 'Preço deve ser maior que zero'),
  description: z.string().optional(),
  categoryId: z.string(),
  subcategoryId: z.string(),
}) satisfies z.ZodType<PostProductsMutationRequest>

export default function ProductPage({ session }: { session: Session }) {
  const [editing, isEditing] = useState(false)
  const uploader = useImageUploader()
  const {
    data: categories,
    isLoading: loadingCategories,
    isError: errorCategories,
  } = useGetCategories({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    mutateAsync: mutatePosProducts,
    error: errorPostProduct,
    isPending,
  } = usePostProducts({
    mutation: {
      mutationKey: postProductsMutationKey(),
    },
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })
  const selectRef = useRef<SelectComponentRef>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(productSchema),
  })

  async function onSubmit(data: PostProductsMutationRequest) {
    const photos = uploader.files

    data.photos = photos

    await mutatePosProducts(
      { data },
      {
        onSuccess: () => {
          //reset()
          //uploader.setFiles([])
          //selectRef.current?.resetCombos()
        },
        onError: (error) => {
          console.log('error', error)
        },
      },
    )
  }

  if (loadingCategories) {
    return <div>Carregando componente</div>
  }

  if (errorCategories) {
    return <div>Erro a carregar componente</div>
  }

  return (
    <div className="">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">
        Adicionar Produto
      </h1>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Imagem */}
          <div className="md:col-span-2">
            <label
              htmlFor="productName"
              className="block text-sm font-medium text-gray-700"
            >
              Imagem do Produto
            </label>
            <div className="mt-1 flex h-20 w-full gap-2 rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
              {uploader.files.length > 0 &&
                uploader.files.map((file, index) => (
                  <div
                    key={index}
                    className="relative h-full w-20 shrink-0 rounded-md"
                  >
                    <Image
                      src={file.preview}
                      alt={`${index}`}
                      objectFit="contain"
                      fill
                      onLoad={() => {
                        URL.revokeObjectURL(file.preview)
                      }}
                    />
                  </div>
                ))}
              <div
                {...uploader.getRootProps()}
                className={`mt-1 flex w-full items-center justify-center rounded-md border-2 border-dashed p-4 ${
                  uploader.isDragActive ? 'border-blue-500' : 'border-gray-300'
                }`}
              >
                <input {...uploader.getInputProps()} />
                {uploader.isDragActive ? (
                  <p className="text-blue-500">Solte os arquivos aqui...</p>
                ) : (
                  <p className="text-gray-500">
                    Arraste e solte arquivos aqui ou clique para selecionar
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Nome do Produto */}
          <div>
            <label
              htmlFor="productName"
              className="block text-sm font-medium text-gray-700"
            >
              Nome do Produto
            </label>
            <input
              type="text"
              id="productName"
              {...register('name')}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o nome do produto"
            />
          </div>

          {/* Preço */}
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-gray-700"
            >
              Preço
            </label>
            <input
              type="number"
              id="price"
              {...register('price', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o preço do produto"
            />
          </div>

          {/* Referência */}
          <div>
            <label
              htmlFor="referenceName"
              className="block text-sm font-medium text-gray-700"
            >
              Referência do Produto
            </label>
            <input
              type="text"
              id="reference"
              {...register('reference')}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite a referencia do produto"
            />
          </div>

          {/* Stock */}
          <div>
            <label
              htmlFor="stock"
              className="block text-sm font-medium text-gray-700"
            >
              Stock
            </label>
            <input
              type="number"
              id="stock"
              {...register('stock', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o stock do produto"
            />
          </div>

          {/* Descrição (ocupa 2 colunas) */}
          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Descrição
            </label>
            <textarea
              id="description"
              rows={4}
              {...register('description')}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite a descrição do produto"
            ></textarea>
          </div>

          {/* Categoria e Subcategoria (SelectComponent) */}
          <div className="md:col-span-2">
            <SelectComponent
              onChange={(categoryId, subcategoryId) => {
                setValue('categoryId', categoryId)
                setValue('subcategoryId', subcategoryId)
              }}
              ref={selectRef}
              categories={categories?.rows}
            />
          </div>
        </div>

        {/* Erros do formulário */}
        {Object.values(errors).length > 0 && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            <ul className="list-disc pl-5">
              {Object.values(errors).map((error, idx) =>
                error?.message ? (
                  <li key={idx}>{error.message as string}</li>
                ) : null,
              )}
            </ul>
          </div>
        )}

        {errorPostProduct && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {errorPostProduct?.response?.data?.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-6 py-2 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            {isPending && (
              <AiOutlineLoading3Quarters className="animate-spin text-xl" />
            )}
            Adicionar Produto
          </button>
        </div>
      </form>
    </div>
  )
}
