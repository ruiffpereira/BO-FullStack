'use client'

import { PostUsersLoginMutationRequest } from '@/server/backoffice'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import routes from '@/routes'

export const loginSchema: z.ZodSchema<PostUsersLoginMutationRequest> = z.object(
  {
    username: z.string().min(1, 'O nome de utilizador é obrigatório'),
    password: z.string().min(1, 'A palavra-passe é obrigatória'),
  },
)

export default function LoginComponent() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validação dos dados com Zod
    const validationResult = loginSchema.safeParse({ username, password })

    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message)
      setLoading(false)
      return
    }

    const result = await signIn('credentials', {
      redirect: false,
      callbackUrl: '/dashboard',
      username,
      password,
    })
    if (result && result?.error) {
      setError('Credenciais inválidas. Tente novamente.')
      setLoading(false)
    } else {
      setError('')
      setLoading(false)
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="flex items-center justify-center h-full ">
      <div className="w-full max-w-md p-8 ">
        <h1 className="mb-6 text-3xl font-bold text-center text-gray-800">
          Code Full Stack
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="mb-4">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="transition-all h-12 w-full px-4 py-2 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
              placeholder="Nome de Utilizador"
              required
            />
          </div>
          <div className="mb-6">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="transition-all h-12 w-full px-4 py-2 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
              placeholder="Palavra Passe"
            />
          </div>
          {error && (
            <p className="mb-4 text-sm text-center text-red-500">{error}</p>
          )}
          <button
            type="submit"
            className="transition-all cursor-pointer w-2/3 flex justify-center place-self-center px-4 py-2 text-white bg-blue-900 rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {loading ? (
              <AiOutlineLoading3Quarters className="animate-spin text-xl" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
