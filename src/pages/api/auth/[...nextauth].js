import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { postUsersLogin } from '@/server/backoffice/hooks/usePostUsersLogin'

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      async authorize(credentials) {
        try {
          const user = await postUsersLogin({
            name: credentials.name,
            password: credentials.password,
          })

          if (user) {
            return user
          } else {
            return null
          }
        } catch (error) {
          console.error(error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name
        token.email = user.email
        token.accessToken = user.token
      }
      return token
    },
    async session({ session, token }) {
      session.user.name = token.name
      session.user.email = token.email
      session.accessToken = token.accessToken
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    maxAge: 6 * 24 * 60 * 60,
    jwt: true,
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    encryption: true,
  },
})
