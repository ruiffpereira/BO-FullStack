import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { checkSessionOnLogin } from '@/utils/checkSession'
import { AiOutlineLoading3Quarters } from "react-icons/ai";


const LoginForm = () => {
  const [credentials, setCredentials] = useState({
    name: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const router = useRouter()

  // Atualiza o estado com os valores dos inputs
  const handleChange = (e) => {
    setIsError(false);
    const { name, value } = e.target
    setCredentials({
      ...credentials,
      [name]: value,
    })
  }

  // Lida com a submissão do formulário
  const handleSubmit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsLoading(true);

    const result = await signIn('credentials', {
      name: credentials.name,
      password: credentials.password,
      redirect: false,
    })
    
    if (result?.error) {
      setIsError(true);
      setIsLoading(false);
      return
    }

    if (result.ok) {
      router.replace('/')
    }
    setCredentials({ name: '', password: '' })
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={credentials.name}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className={`group relative w-full flex items-center gap-2 justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isError ? "bg-red-600": "bg-indigo-600"} hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isLoading ? (
                <AiOutlineLoading3Quarters className='animate-spin text-xl'/>  
              ) : null}
              
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginForm

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSessionOnLogin(context.req)
  if (sessionCheckResult) {
    return sessionCheckResult
  }

  return {
    props: {},
  }
}
