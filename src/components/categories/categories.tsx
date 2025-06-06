'use client'
import { Session } from 'next-auth'
import { useState } from 'react'
import {
  useGetCategories,
  getCategoriesQueryKey,
} from '@/servers/backoffice/hooks/useGetCategories'
import { usePutCategoriesId } from '@/servers/backoffice/hooks/usePutCategoriesId'
import { useDeleteCategoriesId } from '@/servers/backoffice/hooks/useDeleteCategoriesId'
import { usePutSubcategoriesId } from '@/servers/backoffice/hooks/usePutSubcategoriesId'
import { useDeleteSubcategoriesId } from '@/servers/backoffice/hooks/useDeleteSubcategoriesId'
import { useForm } from 'react-hook-form'
import { set, z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Category } from '@/servers/backoffice/types/Category'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  DeleteSubcategoriesIdPathParams,
  DeleteCategoriesIdPathParams,
} from '@/servers/backoffice'
import { c } from '@kubb/core/dist/logger-BWq-oJU_.js'

const categorySchema = z.object({
  name: z.string().min(1, 'Categoria é obrigatória'),
})
type CategoryFormData = z.infer<typeof categorySchema>

const subCategorySchema = z.object({
  categoryId: z.string().min(1, 'Escolher Categoria'),
  name: z.string().min(1, 'Nome da subcategoria é obrigatório'),
})
type SubCategoryFormData = z.infer<typeof subCategorySchema>

export default function CategoriesForm({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')

  const {
    data: categories,
    isLoading,
    error,
  } = useGetCategories({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    mutate: mutateAddCategory,
    error: errorAddCategory,
    isPending: isPendingAddCategory,
  } = usePutCategoriesId({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    mutate: mutateDeleteCategory,
    error: errorDeleteCategory,
    isPending: isPendingDeleteCategory,
  } = useDeleteCategoriesId({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    mutate: mutateAddSubcategory,
    error: errorAddSubcategory,
    isPending: isPendingAddSubcategory,
  } = usePutSubcategoriesId({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    mutate: mutateDeleteSubcategory,
    error: errorDeleteSubcategory,
    isPending: isPendingDeleteSubcategory,
  } = useDeleteSubcategoriesId({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  const {
    register: registerCategory,
    handleSubmit: handleSubmitCategory,
    reset: resetCategory,
    formState: { errors: errorsCategory },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  })

  const {
    register: updateCategory,
    handleSubmit: handleSubmitUpdateCategory,
    reset: resetUpdateCategory,
    formState: { errors: errorsUpdateCategory },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  })

  const {
    register: registerSubCategory,
    handleSubmit: handleSubmitSubCategory,
    reset: resetSubCategory,
    setValue: setValueSubCategory,
    formState: { errors: errorSubCategory },
  } = useForm<SubCategoryFormData>({
    resolver: zodResolver(subCategorySchema),
  })

  const {
    register: updateSubCategory,
    handleSubmit: handleSubmitUpdateSubCategory,
    reset: resetUpdateSubCategory,
    formState: { errors: errorsUpdateSubCategory },
  } = useForm<SubCategoryFormData>({
    resolver: zodResolver(subCategorySchema),
  })

  function onSubmitCategory(data: CategoryFormData) {
    mutateAddCategory(
      {
        id: undefined,
        data: { name: data.name },
      },
      {
        onSuccess: () => {
          toast.success('Add Category Sucess', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
          resetCategory()
        },
        onError: (error) => {
          toast.error('Error Adding Category', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar categoria:', error)
        },
      },
    )
  }

  function onSubmitUpdateCategory(data: CategoryFormData) {
    mutateAddCategory(
      {
        id: editingId ?? '',
        data: { name: data.name },
      },
      {
        onSuccess: () => {
          toast.success('Add Category Sucess', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
          setEditingId(null)
        },
        onError: (error) => {
          toast.error('Error Adding Category', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar categoria:', error)
        },
      },
    )
  }

  function onSubmitNewSubCategory(data: SubCategoryFormData) {
    mutateAddSubcategory(
      {
        id: undefined,
        data: { categoryId: data.categoryId, name: data.name },
      },
      {
        onSuccess: () => {
          toast.success('Add Category Sucess', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
          setValueSubCategory('name', '')
        },
        onError: (error) => {
          toast.error('Erro ao adicionar Subcategoria', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar Subcategoria:', error)
        },
      },
    )
  }

  function onSubmitUpdateSubCategory(data: SubCategoryFormData) {
    mutateAddSubcategory(
      {
        id: editingId ?? '',
        data: { categoryId: data.categoryId, name: data.name },
      },
      {
        onSuccess: () => {
          toast.success('Add Category Sucess', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
          setEditingId(null)
        },
        onError: (error) => {
          toast.error('Erro ao adicionar Subcategoria', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar Subcategoria:', error)
        },
      },
    )
  }

  function onSubmitDeleteCategory(data: DeleteCategoriesIdPathParams) {
    mutateDeleteCategory(
      {
        id: data.id,
      },
      {
        onSuccess: () => {
          toast.success('Removido com sucesso', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
        },
        onError: (error) => {
          toast.error('Erro ao remover Subcategoria', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar Subcategoria:', error)
        },
      },
    )
  }

  function onSubmitDeleteSubcategory(data: DeleteSubcategoriesIdPathParams) {
    mutateDeleteSubcategory(
      {
        id: data.id,
      },
      {
        onSuccess: () => {
          toast.success('Removido com sucesso', {
            style: { background: '#22c55e', color: '#fff' },
          })
          queryClient.invalidateQueries({
            queryKey: getCategoriesQueryKey(),
          })
        },
        onError: (error) => {
          toast.error('Erro ao remover Subcategoria', {
            style: { background: '#ef4444', color: '#fff' },
          })
          console.error('Erro ao adicionar Subcategoria:', error)
        },
      },
    )
  }

  if (isLoading) {
    return <div>Carregando categorias...</div>
  }
  if (error) {
    return <div>Erro ao carregar categorias: {error.message}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Categorias</h1>
      <p className="text-gray-600">
        Aqui você pode gerenciar as categorias dos produtos.
      </p>
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-800">
          Nova Categoria
        </h2>
        <form
          className="flex gap-2"
          onSubmit={handleSubmitCategory(onSubmitCategory)}
        >
          <div className="g-1 flex flex-grow flex-col">
            <input
              type="text"
              placeholder="Nome da categoria"
              {...registerCategory('name')}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {errorsCategory.name && (
              <span className="text-sm text-red-500">
                {errorsCategory.name.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Adicionar
          </button>
        </form>
        <h2 className="my-2 text-lg font-semibold text-gray-800">
          Nova Subcategoria
        </h2>
        <form
          className="flex gap-2"
          onSubmit={handleSubmitSubCategory(onSubmitNewSubCategory)}
        >
          {categories?.rows?.length === 0 ? (
            <p className="text-red-500">
              Nenhuma categoria disponível. Por favor, adicione uma categoria
              primeiro.
            </p>
          ) : (
            <div className="g-1 flex flex-col">
              <select
                {...registerSubCategory('categoryId')}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option key="0" value="">
                  Selecione uma categoria
                </option>
                {categories?.rows?.map((category: Category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errorSubCategory.categoryId && (
                <span className="text-sm text-red-500">
                  {errorSubCategory.categoryId.message}
                </span>
              )}
            </div>
          )}
          <div className="g-2 flex flex-grow flex-col">
            <input
              {...registerSubCategory('name')}
              type="text"
              placeholder="Nome da subcategoria"
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {errorSubCategory.name && (
              <span className="text-sm text-red-500">
                {errorSubCategory.name.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Adicionar
          </button>
        </form>
      </div>

      {(categories?.rows?.length ?? 0) > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {categories?.rows?.map((category: Category) => (
            <div
              key={category.categoryId}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                {editingId !== category.categoryId ? (
                  <>
                    <h2 className="text-lg font-semibold text-gray-800">
                      {category.name}
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setInputValue(category.name)
                          setEditingId(category.categoryId)
                          resetUpdateCategory({ name: category.name })
                        }}
                        className="rounded bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() =>
                          onSubmitDeleteCategory({
                            id: category.categoryId,
                          })
                        }
                        className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                ) : (
                  <form
                    onSubmit={handleSubmitUpdateCategory(
                      onSubmitUpdateCategory,
                    )}
                    className="flex flex-grow items-center gap-2"
                  >
                    <input
                      {...updateCategory('name')}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    {errorsUpdateCategory.name && (
                      <span className="text-sm text-red-500">
                        {errorsUpdateCategory.name.message}
                      </span>
                    )}
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(category.categoryId)
                        }}
                        className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
              <ul className="space-y-2">
                {(category.subcategories?.length ?? 0) > 0 ? (
                  category?.subcategories?.map((subcategory) =>
                    editingId !== subcategory.subcategoryId ? (
                      <li
                        key={subcategory.subcategoryId}
                        className="flex items-center justify-between"
                      >
                        <div className="text-gray-700">{subcategory.name}</div>
                        <div className="flex gap-2">
                          <button
                            className="rounded bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                            onClick={() => {
                              setEditingId(subcategory.subcategoryId)
                              resetUpdateSubCategory({
                                categoryId: subcategory.categoryId,
                                name: subcategory.name,
                              })
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              onSubmitDeleteSubcategory({
                                id: subcategory.subcategoryId,
                              })
                            }
                            className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={subcategory.subcategoryId}
                        className="flex items-center justify-between"
                      >
                        <form
                          onSubmit={handleSubmitUpdateSubCategory(
                            onSubmitUpdateSubCategory,
                          )}
                          className="flex flex-grow items-center gap-2"
                        >
                          <input
                            {...updateSubCategory('name')}
                            defaultValue={subcategory.name}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          {errorsUpdateCategory.name && (
                            <span className="text-sm text-red-500">
                              {errorsUpdateCategory.name.message}
                            </span>
                          )}
                          <div className="ml-auto flex gap-2">
                            <button
                              type="submit"
                              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                              onClick={() => {
                                setEditingId(subcategory.subcategoryId)
                              }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                            >
                              cancelar
                            </button>
                          </div>
                        </form>
                      </li>
                    ),
                  )
                ) : (
                  <li className="text-gray-500">Nenhuma subcategoria</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
