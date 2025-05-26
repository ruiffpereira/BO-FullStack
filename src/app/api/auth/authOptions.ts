// src/app/api/auth/authOptions.ts
import { postUsersLogin } from '@/servers/backoffice/hooks/usePostUsersLogin'
import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

declare module 'next-auth' {
  interface User {
    accessToken?: string
  }
  interface Session {
    accessToken?: string
  }
}
// ...importa providers e callbacks conforme o teu projeto...

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: {
          label: 'Username',
          type: 'text',
          placeholder: 'Seu nome de usuário',
        },
        password: {
          label: 'Password',
          type: 'password',
          placeholder: 'Sua senha',
        },
      },
      async authorize(credentials) {
        try {
          // Substitua esta lógica pela chamada à sua API ou banco de dados
          const user = await postUsersLogin({
            username: credentials?.username || '',
            password: credentials?.password || '',
          })

          // Validação do retorno da API
          if (!user || !user.accessToken) {
            throw new Error(
              'Falha na autenticação. Verifique suas credenciais.',
            )
          }

          return {
            id: user.userId || '',
            name: user.username,
            email: user.email,
            accessToken: user.accessToken,
            image: null,
          }
        } catch (error) {
          console.error('Erro ao autenticar:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      //console.log('JWT Callback:', token)
      if (user) {
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      if (session) {
        session.accessToken = token.accessToken as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 6 dias
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  pages: {
    signIn: '/admin',
  },
}
