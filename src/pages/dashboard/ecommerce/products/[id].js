// components/ProductForm.js

import AntdCascader from '@/components/cascader'
import Link from 'next/link'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import { useRouter } from 'next/router'
import { checkSession } from '@/utils/checkSession'
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

const ProductForm = ({ token, product, categories }) => {
  const [errorMessage, setErrorMessage] = useState(null)
  const urlSWRProducts = `${BASE_URL}/products`
  const router = useRouter()

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const { mutate } = useSWRConfig()

  const [formData, setFormData] = useState({
    productId: product?.productId || '',
    name: product?.name || '',
    reference: product?.reference || '',
    description: product?.description || '',
    price: product?.price || '',
    stock: product?.stock || '',
    photos: product?.photos || [],
    category: product?.category?.name || '',
    subcategory: product?.subcategory?.name || '',
    categoryId: product?.categoryId || '',
    subcategoryId: product?.subcategoryId || '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await handleSubmitUser()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const { trigger: handleSubmitUser } = useSWRMutation(
    urlSWRProducts,
    async (url) => {
      const response = await fetch(url, {
        method: product?.productId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        console.log(errorMessage)
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      console.log('response submit: ', response)
      return response
    },
    {
      onSuccess: async (data) => {
        if (data.error) {
          console.log('Erro detectado: ', data.error)
          return // Não prossegue se houver um erro
        }
        setErrorMessage(null) // Limpa a mensagem de erro em caso de sucesso
        await mutate(urlSWRProducts)
        router.push('/dashboard/ecommerce')
      },
      onError: (error) => {
        console.log('Erro detectado: ', error.message)
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: deleteProduct } = useSWRMutation(
    `${urlSWRProducts}/${formData.productId}`,
    async (url) => {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        console.log(errorMessage)
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
      console.log('response submit: ', response)
      return response
    },
    {
      onSuccess: async (data) => {
        if (data.error) {
          console.log('Erro detectado: ', data.error)
          return // Não prossegue se houver um erro
        }
        setErrorMessage(null) // Limpa a mensagem de erro em caso de sucesso
        await mutate(urlSWRProducts)
        router.push('/dashboard/ecommerce')
      },
      onError: (error) => {
        console.log('Erro detectado: ', error.message)
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCascaderChange = (value) => {
    if (value === undefined) {
      setFormData((prev) => ({
        ...prev,
        categoryId: null,
        category: null,
        subcategory: null,
        subcategoryId: null,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        categoryId: value[0],
        subcategoryId: value[1],
      }))
    }
  }

  const onDrop = (acceptedFiles) => {
    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...acceptedFiles],
    }))
  }

  const { getRootProps, getInputProps } = useDropzone({ onDrop })

  // // Transformando categorias e subcategorias para o formato do Cascader
  const categoryOptions =
    categories?.rows?.map((category) => ({
      value: category.categoryId,
      label: category.name,
      children: category.subcategories.map((subcategory) => ({
        value: subcategory.subcategoryId,
        label: subcategory.name,
      })),
    })) ?? []

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 p-6 bg-white shadow-lg rounded-lg"
    >
      {errorMessage && <div className="error">{errorMessage}</div>}
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Name:</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Reference:</label>
        <input
          type="text"
          name="reference"
          value={formData.reference}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Description:</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Price:</label>
        <textarea
          name="price"
          value={formData.price}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Stock:</label>
        <textarea
          name="stock"
          value={formData.stock}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Photos:</label>
        <div
          {...getRootProps()}
          className="border-dashed border-2 border-gray-300 p-4 rounded-md"
        >
          <input {...getInputProps()} />
          <p>Drag drop some files here, or click to select files</p>
        </div>
        <div className="mt-2">
          {formData.photos.map((file, index) => (
            <div key={index} className="text-sm text-gray-600">
              {file.name || file}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Category:</label>
        <AntdCascader
          data={categoryOptions}
          onChange={handleCascaderChange}
          defaultValue={[formData.category, formData.subcategory]}
          placeholder="Select Category and Subcategory"
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="flex gap-2">
        <Link
          className="w-full text-center py-3 mt-6 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          href="/dashboard/ecommerce"
        >
          Back
        </Link>
        <button
          type="submit"
          className="w-full py-3 mt-6 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {product?.productId ? 'Update' : 'Create'} Product
        </button>
        {product?.productId && (
          <button
            onClick={deleteProduct}
            className="w-full py-3 mt-6 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  )
}

export default ProductForm

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)

  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  // Se a sessão existir, você pode acessar o token
  const { token } = sessionCheckResult.props
  const { id } = context.params

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const [productRes, categoriesRes] = await Promise.all([
    fetch(`${BASE_URL}/products/${id}`, { headers }),
    fetch(`${BASE_URL}/categories`, { headers }),
  ])

  const [product, categories] = await Promise.all([
    productRes.json(),
    categoriesRes.json(),
  ])

  return {
    props: {
      token,
      product,
      categories,
    },
  }
}