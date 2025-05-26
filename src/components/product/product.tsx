'use client'

import z from 'zod'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { useGetCategories } from '@/servers/backoffice/hooks/useGetCategories'
import { PostProductsMutationRequest } from '@/servers/backoffice/types/PostProducts'
import {
  usePutProductsId,
  putProductsIdMutationKey,
} from '@/servers/backoffice/hooks/usePutProductsId'
import {
  postProductsMutationKey,
  usePostProducts,
} from '@/servers/backoffice/hooks/usePostProducts'
import { Session } from 'next-auth'
import { useImageUploader } from '@/components/product/image-uploader'
import SelectComponent, { SelectComponentRef } from './combobox'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import routes from '@/routes'
import { toast } from 'sonner'
import { Product } from '@/servers/backoffice/types/Product'
import { PutProductsIdMutationRequest } from '@/servers/backoffice'

type FileWithPreview = File & { preview: string; name: string }

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  photos: z.array(z.any()).min(1, 'Imagem do produto é obrigatória').optional(),
  reference: z.string(),
  stock: z
    .number()
    .min(1, 'Quantidade em estoque deve ser maior ou igual a zero'),
  price: z.number().min(1, 'Preço deve ser maior que zero'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  subcategoryId: z.string().optional(),
}) satisfies z.ZodType<PostProductsMutationRequest>

export default function ProductPage({
  session,
  productData,
}: {
  session: Session
  productData?: Product
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [photosToRemove, setPhotosToRemove] = useState<string[]>([])

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

  const { mutateAsync: mutatePutProductsId, isPending: isPendingPutProduct } =
    usePutProductsId({
      mutation: {
        mutationKey: putProductsIdMutationKey(),
      },
      client: {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    })

  const existingImages =
    productData?.photos?.map((photo) => ({
      name: photo,
      size: 0,
      type: 'image',
      preview: `${process.env.NEXT_PUBLIC_CONTAINERRAIZ}/${photo.slice(2)}`,
    })) ?? []

  const uploader = useImageUploader(existingImages as FileWithPreview[])
  const selectRef = useRef<SelectComponentRef>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: productData?.name || '',
      price: productData?.price || 0,
      stock: productData?.stock || 0,
      reference: productData?.reference || '',
      description: productData?.description || '',
    },
  })

  async function onSubmit(data: PostProductsMutationRequest) {
    const formData = new FormData()
    formData.append('name', data.name!)
    formData.append('price', String(data.price))
    formData.append('stock', String(data.stock))
    if (data.reference) formData.append('reference', data.reference)
    if (data.description) formData.append('description', data.description)
    formData.append('categoryId', data.categoryId!)
    formData.append('subcategoryId', data.subcategoryId ?? '')

    uploader.files.forEach((file) => {
      if (file instanceof File) {
        formData.append('photos', file)
      }
    })

    // Envie as fotos removidas
    photosToRemove.forEach((photoName) => {
      formData.append('photosToRemove', photoName)
    })

    if (!productData) {
      await mutatePosProducts(
        { data: formData as unknown as PutProductsIdMutationRequest },
        {
          onSuccess: () => {
            toast.success('Add product Sucess', {
              style: { background: '#22c55e', color: '#fff' },
            })
            reset()
            uploader.setFiles([])
            selectRef.current?.resetCombos()
            queryClient.invalidateQueries({
              queryKey: postProductsMutationKey(),
            })
            router.push(routes.ecommerce)
          },
          onError: (error) => {
            console.log('error', error)
            toast.error('Erro product Sucess', {
              style: { background: '#ef4444', color: '#fff' },
            })
          },
        },
      )
    } else {
      await mutatePutProductsId(
        {
          id: productData.productId,
          data: formData as unknown as PutProductsIdMutationRequest,
        },
        {
          onSuccess: () => {
            toast.success('Add product Sucess', {
              style: { background: '#22c55e', color: '#fff' },
            })
            reset()
            uploader.setFiles([])
            selectRef.current?.resetCombos()
            queryClient.invalidateQueries({
              queryKey: postProductsMutationKey(),
            })
            router.push(routes.ecommerce)
          },
          onError: (error) => {
            console.log('error', error)
            toast.error('Erro product Sucess', {
              style: { background: '#ef4444', color: '#fff' },
            })
          },
        },
      )
    }
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
                uploader.files.map((file: FileWithPreview, index: number) => (
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
                    <button
                      type="button"
                      onClick={() => {
                        // Se for imagem antiga (não é File), guarda o nome
                        if (!(file instanceof File)) {
                          setPhotosToRemove((prev) => [
                            ...prev,
                            (file as FileWithPreview).name,
                          ])
                        }
                        // Remove do uploader
                        uploader.setFiles((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }}
                      className="absolute top-0 right-0 cursor-pointer rounded-full bg-red-500 p-1 text-white"
                    >
                      X
                    </button>
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
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
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
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">
                {errors.price.message}
              </p>
            )}
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
            {errors.reference && (
              <p className="mt-1 text-sm text-red-600">
                {errors.reference.message}
              </p>
            )}
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
            {errors.stock && (
              <p className="mt-1 text-sm text-red-600">
                {errors.stock.message}
              </p>
            )}
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
              defaultCategoryId={productData?.categoryId || ''}
              defaultSubcategoryId={productData?.subcategoryId || ''}
            />
            {errors.categoryId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.categoryId.message}
              </p>
            )}
            {errors.subcategoryId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.subcategoryId.message}
              </p>
            )}
          </div>
        </div>

        {errorPostProduct && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {errorPostProduct?.response?.data?.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex gap-4 rounded-md bg-blue-600 px-6 py-2 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            {isPending ||
              (isPendingPutProduct && (
                <AiOutlineLoading3Quarters className="animate-spin text-xl" />
              ))}
            Adicionar Produto
          </button>
        </div>
      </form>
    </div>
  )
}
