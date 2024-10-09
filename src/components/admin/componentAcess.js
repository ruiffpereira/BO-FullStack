import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

function ComponentsAccess({ token }) {
  const [currentComponent, setCurrentComponent] = useState({
    componentId: null,
    name: '',
  })
  const [selectPermissions, setSelectPermissions] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)

  const urlSWRPermissions = `${BASE_URL}/permissions`
  const urlSWRComponents = `${BASE_URL}/components`

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

  const { data: permissions, isLoading: isLoadingPermissions } = useSWR(
    urlSWRPermissions,
    fetcher,
  )
  const { data: components, isLoading: isLoadingComponents } = useSWR(
    urlSWRComponents,
    fetcher,
  )

  const { mutate } = useSWRConfig()

  const handleSubmit = (e) => {
    e.preventDefault()
    handleAddEditComponent({ arg: currentComponent })
  }

  const handleEdit = (component) => {
    setCurrentComponent(component)
    setSelectPermissions([])
    component.permissions.forEach((permission) => {
      setSelectPermissions((prevPermissions) => {
        return [...prevPermissions, permission.permissionId]
      })
    })
  }

  const handleDelete = (componentId) => {
    console.log(componentId)
    handleDeleteComponent({ arg: componentId })
  }

  const handlePermissionChange = (permissionId) => {
    setSelectPermissions((prevSelectedPermissions) =>
      prevSelectedPermissions.includes(permissionId)
        ? prevSelectedPermissions.filter((id) => id !== permissionId)
        : [...prevSelectedPermissions, permissionId],
    )
  }

  const { trigger: handleAddEditComponent } = useSWRMutation(
    urlSWRComponents,
    async (url, { arg: component }) => {
      const response = await fetch(
        component.arg.componentId ? `${url}/${component.arg.componentId}` : url,
        {
          method: component.arg.componentId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify({
            ...component.arg,
            selectPermissions,
          }),
        },
      )
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'An unexpected error occurred'
        setErrorMessage(errorMessage) // Captura a mensagem de erro
        console.log(errorMessage)
        return { error: errorMessage } // Retorna um objeto de erro
      }
      return response
    },
    {
      onSuccess: async (data) => {
        if (data.error) {
          console.log(data.error)
          return // Não prossegue se houver um erro
        }
        setErrorMessage(null) // Limpa a mensagem de erro em caso de sucesso
        setCurrentComponent({ componentId: null, name: '' })
        setSelectPermissions([])
        await mutate(urlSWRComponents)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: handleDeleteComponent } = useSWRMutation(
    urlSWRComponents,
    async (url, { arg: component }) => {
      console.log(component.arg.componentId)
      const response = await fetch(`${url}/${component.arg}`, {
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
          return // Não prossegue se houver um erro
        }
        setErrorMessage(null) // Limpa a mensagem de erro em caso de sucesso
        setCurrentComponent({ componentId: null, name: '' })
        await mutate(urlSWRComponents)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  if (isLoadingComponents || isLoadingPermissions) return <div>Loading...</div>

  return (
    <div className="">
      {errorMessage && <div className="error">{errorMessage}</div>}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
      >
        <div className="mb-4">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="componentName"
          >
            Component Name
          </label>
          <input
            type="text"
            id="componentName"
            value={currentComponent.name}
            onChange={(e) =>
              setCurrentComponent({ ...currentComponent, name: e.target.value })
            }
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Quem tem acesso
          </label>
          {permissions.map((permission) => (
            <div
              key={permission.permissionId}
              className="flex items-center mb-2"
            >
              <input
                type="checkbox"
                id={permission.permissionId}
                checked={selectPermissions.includes(permission.permissionId)}
                onChange={() => handlePermissionChange(permission.permissionId)}
                className="mr-2 leading-tight"
              />
              <label className="text-gray-700">{permission.name}</label>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {currentComponent.componentId !== null ? 'Update' : 'Create'}
          </button>
          {currentComponent.componentId !== null && (
            <button
              type="button"
              onClick={() => {
                // Lógica para cancelar a edição
                setCurrentComponent({ componentId: null, name: '' })
                setSelectPermissions([])
              }}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>
      <div>
        {components.map((component) => (
          <div
            key={component.componentId}
            className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
          >
            <h2 className="text-xl font-bold mb-2">{component.name}</h2>
            <p className="mb-4">Permissions access:</p>
            <ul className="list-disc list-inside mb-4">
              {component.permissions.map((permission) => {
                return <li key={permission.permissionId}>{permission.name}</li>
              })}
            </ul>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  handleEdit(component)
                  console.log(component)
                }}
                className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(component.componentId)}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ComponentsAccess
