import AntdCascader from '@/components/cascader'
import Link from 'next/link'
import { useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import { useRouter } from 'next/router'
import { checkSession } from '@/utils/checkSession'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const URL_RAIZ = process.env.NEXT_PUBLIC_CONTAINERRAIZ

const ProductForm = ({ token, product, categories }) => {
  const [errorMessage, setErrorMessage] = useState(null)
  const urlSWRProducts = `${BASE_URL}/products`
  const router = useRouter()
  const validImageExtensions = ['jpg', 'jpeg', 'png']

  const headers = {
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

  const [removedPhotos, setRemovedPhotos] = useState([])

  const handleRemovePhoto = (photo) => {
    setRemovedPhotos((prev) => [...prev, photo])
    setFormData((prevData) => ({
      ...prevData,
      photos: prevData.photos.filter((p) => p !== photo),
    }))
  }

  const handleSubmit = async (e) => {
    console.log('Enviando dados do produto:', formData)
    e.preventDefault()
    try {
      console.log('Enviando dados do produto:', formData)
      await handleSubmitUser()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const { trigger: handleSubmitUser, isMutating } = useSWRMutation(
    urlSWRProducts,
    async (url) => {
      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      formDataToSend.append('reference', formData.reference)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('price', formData.price)
      formDataToSend.append('stock', formData.stock)
      formDataToSend.append('categoryId', formData.categoryId)
      formDataToSend.append('subcategoryId', formData.subcategoryId)
      formDataToSend.append('productId', formData.productId)

      // Adiciona as fotos ao FormData
      formData.photos.forEach((file) => {
        if (file instanceof File) {
          formDataToSend.append('photos', file)
        } else {
          formDataToSend.append('existingPhotos', file)
        }
      })
      // Adiciona as fotos removidas ao FormData
      formDataToSend.append('removedPhotos', JSON.stringify(removedPhotos))

      const method = formData.productId ? 'PUT' : 'POST'

      console.log('formDataToSend:', formData.subcategoryId)

      const response = await fetch(url, {
        method, // Certifique-se de que o método é PUT para atualização
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
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
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        return { error: errorMessage } // Retorna um objeto de erro
      }
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

  const isValidImage = (file) => {
    const extension = file.name.split('.').pop().toLowerCase()
    return validImageExtensions.includes(extension)
  }

  const onDrop = (acceptedFiles) => {
    const validFiles = acceptedFiles.filter(
      (file) =>
        ['image/jpeg', 'image/png'].includes(file.type) && isValidImage(file),
    )
    setFormData((prevData) => ({
      ...prevData,
      photos: [...prevData.photos, ...validFiles],
    }))
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  })

  // Transformando categorias e subcategorias para o formato do Cascader
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
    <form className="space-y-6 p-6 bg-white shadow-lg rounded-lg">
      {errorMessage && <div className="error">{errorMessage}</div>}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-4">
          <label className="text-gray-600 font-semibold">Photos:</label>
          <div
            {...getRootProps()}
            className="border-dashed border-2 border-gray-300 p-4 rounded-md"
          >
            <input {...getInputProps()} />
            <p>Drag drop some files here, or click to select files</p>
          </div>
          <div className="mt-2 flex gap-2">
            {formData.photos.map((file, index) => (
              <div key={index} className="relative">
                {file instanceof File ? (
                  <Image
                    width={50}
                    height={50}
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index}`}
                    className="object-contain rounded-md"
                  />
                ) : (
                  <Image
                    width={50}
                    height={50}
                    src={`${URL_RAIZ}/${file}`}
                    alt={`Preview ${index}`}
                    className="object-contain rounded-md"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(file)}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
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
        <input
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex flex-col space-y-4">
        <label className="text-gray-600 font-semibold">Stock:</label>
        <input
          type="number"
          name="stock"
          value={formData.stock}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
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
          onClick={handleSubmit}
          className="w-full py-3 mt-6 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isMutating}
        >
          {isMutating ? 'Loading...' : product?.productId ? 'Update' : 'Create'}{' '}
          Product
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
