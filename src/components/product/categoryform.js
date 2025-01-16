import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

const CategoryManager = ({ token }) => {
  const [newCategory, setNewCategory] = useState('')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [editCategory, setEditCategory] = useState(null)
  const [editSubcategory, setEditSubcategory] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const urlSWRCategories = `${BASE_URL}/categories`
  const urlSWRSubcategories = `${BASE_URL}/subcategories`

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const fetcher = async (url) => {
    const res = await fetch(url, {
      headers,
    })
    if (!res.ok) {
      const errorData = await res.json()
      const error = new Error('An error occurred while fetching the data.')
      error.info = errorData
      error.status = res.status
      throw error
    }
    return res.json()
  }

  const { data: dataCategories, isLoading: isLoadingCategories } = useSWR(
    urlSWRCategories,
    fetcher,
  )

  const { mutate } = useSWRConfig()

  const { trigger: addCategory } = useSWRMutation(
    urlSWRCategories,
    async (url) => {
      if (newCategory === '') return
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newCategory,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(urlSWRCategories)
        setNewCategory('')
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: addSubcategory } = useSWRMutation(
    urlSWRSubcategories,
    async (url) => {
      if (selectedCategory === '') {
        return
      }
      if (newSubcategory === '') {
        return
      }
      const response = await fetch(`${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ selectedCategory, newSubcategory }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(urlSWRCategories)
        setNewSubcategory('')
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: deleteCategory } = useSWRMutation(
    urlSWRCategories,
    async (url, { arg: categoryId }) => {
      const response = await fetch(`${url}/${categoryId}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(urlSWRCategories)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: deleteSubcategory } = useSWRMutation(
    `${BASE_URL}/subcategories`,
    async (url, { arg }) => {
      const response = await fetch(`${url}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify(arg),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(`${BASE_URL}/categories`)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: updateCategory } = useSWRMutation(
    urlSWRCategories,
    async (url, { arg }) => {
      const response = await fetch(`${url}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(arg),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(urlSWRCategories)
        setEditCategory(null)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: updateSubcategory } = useSWRMutation(
    urlSWRSubcategories,
    async (url, { arg }) => {
      const response = await fetch(`${url}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(arg),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async () => {
        await mutate(urlSWRCategories)
        setEditSubcategory(null)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  // if (error) return <div>Failed to load</div>
  if (isLoadingCategories) return <div>Loading...</div>

  return (
    <div className="p-6 bg-white rounded-xl shadow-md space-y-4 text-left">
      <h1 className="text-xl font-bold">Gerenciador de Categorias</h1>
      {errorMessage && <div className="error">{errorMessage}</div>}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Nova Categoria"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          onClick={addCategory}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Adicionar Categoria
        </button>
      </div>

      <div className="space-y-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="">Selecione uma Categoria</option>
          {dataCategories?.rows?.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.name}
            </option>
          )) ?? (
            <option value="" disabled>
              No categories available
            </option>
          )}
        </select>
        <input
          type="text"
          placeholder="Nova Subcategoria"
          value={newSubcategory}
          onChange={(e) => setNewSubcategory(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          onClick={addSubcategory}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Adicionar Subcategoria
        </button>
      </div>

      <div className="space-y-4">
        {dataCategories?.rows?.map((category) => (
          <div key={category.categoryId} className="border p-4 rounded">
            <div className="flex justify-between items-center">
              {editCategory?.id === category.categoryId ? (
                <div className="flex gap-2 w-full flex-wrap">
                  <input
                    type="text"
                    value={editCategory.name}
                    onChange={(e) =>
                      setEditCategory({ ...editCategory, name: e.target.value })
                    }
                    className="border p-2 max-w-72 flex-grow"
                  />
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() =>
                        updateCategory({
                          categoryId: category.categoryId,
                          name: editCategory.name,
                        })
                      }
                      className="bg-green-500 text-white px-2 py-1 rounded ml-auto"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditCategory(null)}
                      className="bg-gray-500 text-white px-2 py-1 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-grow min-w-0">
                  <h2 className="text-lg font-bold flex-grow text-ellipsis overflow-hidden">
                    {category.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditCategory({
                          id: category.categoryId,
                          name: category.name,
                        })
                      }
                      className="bg-yellow-500 text-white px-2 py-1 rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteCategory(category.categoryId)}
                      className="bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              )}
            </div>
            {category.subcategories.length > 0 ? (
              <ul className="list-disc list-inside mt-2 flex flex-col gap-2">
                {category.subcategories.map((subcategory) => (
                  <li
                    key={subcategory.subcategoryId}
                    className="flex justify-between items-center"
                  >
                    {editSubcategory?.id === subcategory.subcategoryId ? (
                      <div className="flex gap-2 flex-wrap w-full">
                        <input
                          type="text"
                          value={editSubcategory.name}
                          onChange={(e) =>
                            setEditSubcategory({
                              ...editSubcategory,
                              name: e.target.value,
                            })
                          }
                          className="border p-2 max-w-72 flex-grow"
                        />
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() =>
                              updateSubcategory({
                                categoryId: category.categoryId,
                                subcategoryId: subcategory.subcategoryId,
                                name: editSubcategory.name,
                              })
                            }
                            className="bg-green-500 text-white px-2 py-1 rounded"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditSubcategory(null)}
                            className="bg-gray-500 text-white px-2 py-1 rounded"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <p className="text-ellipsis overflow-hidden">
                          {subcategory.name}
                        </p>
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() =>
                              setEditSubcategory({
                                id: subcategory.subcategoryId,
                                name: subcategory.name,
                              })
                            }
                            className="bg-yellow-500 text-white px-2 py-1 rounded"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              deleteSubcategory({
                                categoryId: category.categoryId,
                                subcategoryId: subcategory.subcategoryId,
                              })
                            }
                            className="bg-red-500 text-white px-2 py-1 rounded"
                          >
                            Apagar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Esta categoria não tem subcategorias.
              </p>
            )}
          </div>
        )) ?? (
          <option value="" disabled>
            No categories available
          </option>
        )}
      </div>
    </div>
  )
}

export default CategoryManager
