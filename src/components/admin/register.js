import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import crypto from 'crypto'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

function Registerform({ token }) {
  const urlSWRUser = `${BASE_URL}/users`
  const urlSWRPermissions = `${BASE_URL}/permissions`

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const { mutate } = useSWRConfig()

  const fetcher = (url) => {
    return fetch(url, {
      headers,
    }).then((res) => res.json())
  }

  const { data: users, isLoading : isLoadingUsers } = useSWR(urlSWRUser, fetcher)
  const { data: permissions, isLoading: isLoadingPermissions } = useSWR(urlSWRPermissions, fetcher)
  const [showPassword, setShowPassword] = useState(false)
  
  const [currentUser, setCurrentUser] = useState({
    userId: null,
    name: '',
    email: '',
    password: '',
    permissionId: '',
    secretkeysite: false,
  })

  const [errorMessage, setErrorMessage] = useState(null)

  const generateSecretKey = async () => {
    setCurrentUser((prevUser) => ({
      ...prevUser,
      secretkeysite: true,
    }));

  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await handleSubmitUser({ currentUser })
    } catch (error) {
      console.error('Erro ao adicionar/editar regra:', error)
    }
  }

  const handleEdit = async (user) => {
    setCurrentUser({
      ...user,
      permissionId: user.permissions[0]?.permissionId ?? '',
    })
  }

  const handleDelete = async (userId) => {
    try {
      await handleDeleteUser({ userId })
    } catch (error) {
      console.error('Erro ao adicionar/editar regra:', error)
    }
  }

  const handleChangePassword = async (userId) => {
    try {
      await handleSubmitUser({ userId })
    } catch (error) {
      console.error('Erro ao adicionar/editar regra:', error)
    }
  }

  const { trigger: handleDeleteUser } = useSWRMutation(
    urlSWRUser,
    async (url, { arg }) => {
      const response = await fetch(`${url}/${arg.userId}`, {
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
        await mutate(urlSWRUser)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  const { trigger: handleSubmitUser } = useSWRMutation(
    urlSWRUser,
    async (url, { arg }) => {
      const response = await fetch(
        arg.currentUser.userId ? url : `${url}/register`,
        {
          method: arg.currentUser.userId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(arg.currentUser),
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
        setCurrentUser({
          userId: null,
          name: '',
          email: '',
          password: '',
          permissionId: '',
          secretkeysite: '',
        })
        await mutate(urlSWRUser)
      },
      onError: (error) => {
        setErrorMessage(error.message) // Captura a mensagem de erro
      },
    },
  )

  if (isLoadingUsers) return <div>Loading...</div>
  if (isLoadingPermissions) return <div>Loading...</div>

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg shadow-lg w-full">
      <h2 className="text-2xl font-semibold">Clientes</h2>
      {errorMessage && <div className="error">{errorMessage}</div>}
      <form onSubmit={handleSubmit} className="mb-4 flex flex-col space-y-4">
        <input
          value={currentUser.name}
          onChange={(e) =>
            setCurrentUser({ ...currentUser, name: e.target.value })
          }
          placeholder="Nome"
          required
          className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
        <input
          type="text"
          value={currentUser.email}
          onChange={(e) =>
            setCurrentUser({ ...currentUser, email: e.target.value })
          }
          placeholder="Email"
          className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
        <select
          id="permission"
          name="permission"
          value={currentUser.permissionId || ''}
          onChange={(e) =>
            setCurrentUser({ ...currentUser, permissionId: e.target.value })
          }
          className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        >
          <option value="" disabled>
            Select your option
          </option>
          {permissions &&
            permissions.map((permission) => (
              <option
                key={permission.permissionId}
                value={permission.permissionId}
              >
                {permission.name}
              </option>
            ))}
        </select>
        {!currentUser.userId && (
          <input
            type="password"
            value={currentUser.password}
            onChange={(e) =>
              setCurrentUser({ ...currentUser, password: e.target.value })
            }
            placeholder="Senha"
            required
            className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        )}
        {currentUser.userId && (
          <form
            onSubmit={handleChangePassword}
            className="mb-4 flex flex-col space-y-4"
          >
            <input
              type="password"
              onChange={(e) =>
                setCurrentUser({ ...currentUser, password: e.target.value })
              }
              placeholder="Nova Senha"
              required
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </form>
        )}

        <div className="flex gap-4">
          <input
            type={showPassword ? 'text' : 'password'}
            value={currentUser.secretkeysite}
            onChange={(e) =>
              setCurrentUser({ ...currentUser, secretkeysite: e.target.value })
            }
            placeholder="key"
            disabled
            className="flex-grow shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="text-xl flex items-center text-gray-700"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
          <button
            className="bg-slate-500 hover:bg-slate-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline flex-shrink-0 ml-auto"
            type="button"
            onClick={generateSecretKey}
          >
            Gerar Key
          </button>
        </div>
        <div className="flex justify-between">
          {currentUser.userId ? (
            <button
              type="button"
              onClick={() => {
                setCurrentUser({
                  userId: null,
                  name: '',
                  email: '',
                  password: '',
                  permissionId: '',
                  secretkeysite: false,
                })
                setShowPassword(false)
              }}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Cancelar
            </button>
          ) : null}

          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {currentUser.userId ? 'Atualizar' : 'Adicionar'}
          </button>
        </div>
      </form>

      <ul>
        {users.map((user) => (
          <li
            key={user.userId}
            className="flex justify-between items-center mb-2 p-2 shadow rounded gap-2"
          >
            <div className="flex flex-wrap gap-2 min-w-0">
              <p className="text-gray-800 text-ellipsis overflow-hidden">
                {user.name}
              </p>
              <p className="text-gray-600 text-ellipsis overflow-hidden">
                {user.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleEdit(user)
                  setShowPassword(false)
                }}
                className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(user.userId)}
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

export default Registerform
