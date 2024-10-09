import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

function RulesComponent({ token }) {
  const [currentRule, setCurrentRule] = useState({
    permissionId: null,
    name: '',
  })
  const [errorMessage, setErrorMessage] = useState(null)

  const urlSWR = `${BASE_URL}/permissions`
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

  const { data, isLoading } = useSWR(urlSWR, fetcher)

  const { mutate } = useSWRConfig()

  const handleEdit = (rule) => {
    setCurrentRule(rule)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await handleAddEditRule({ arg: currentRule })
    } catch (error) {
      console.error('Erro ao adicionar/editar regra:', error)
    }
  }

  const { trigger: handleAddEditRule } = useSWRMutation(
    urlSWR,
    async (url, { arg: rule }) => {
      const response = await fetch(
        rule.arg.permissionId ? `${url}/${rule.arg.permissionId}` : url,
        {
          method: rule.arg.permissionId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(rule.arg),
        },
      )
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
        setCurrentRule({ permissionId: null, name: '' })
        await mutate(urlSWR)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: deletePermission } = useSWRMutation(
    urlSWR,
    async (url, { arg: permissionId }) => {
      const response = await fetch(`${url}/${permissionId.arg}`, {
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
        await mutate(urlSWR)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg shadow-lg w-full">
      <h2 className="text-2xl font-semibold">Permissoes</h2>
      {errorMessage && <div className="error">{errorMessage}</div>}
      <form
        onSubmit={handleSubmit}
        className="mb-4 flex justify-between items-center"
      >
        <input
          type="text"
          value={currentRule.name}
          onChange={(e) =>
            setCurrentRule({ ...currentRule, name: e.target.value })
          }
          required
          className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
        {currentRule.permissionId ? (
          <button
            onClick={() => {
              setCurrentRule({ permissionId: null, name: '' })
              setErrorMessage(null)
            }}
            type="submit"
            className="ml-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancelar
          </button>
        ) : (
          ''
        )}

        <button
          type="submit"
          className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {currentRule.permissionId ? 'Guardar' : 'Adicionar'}
        </button>
      </form>
      <ul>
        {data.map((rule) => (
          <li
            key={rule.permissionId}
            className="flex justify-between items-center mb-2 p-2 shadow rounded"
          >
            <span className="text-gray-800">{rule.name}</span>
            <div>
              <button
                onClick={() => handleEdit(rule)}
                className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline mr-2"
              >
                Editar
              </button>
              <button
                onClick={() => deletePermission({ arg: rule.permissionId })}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
              >
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RulesComponent
