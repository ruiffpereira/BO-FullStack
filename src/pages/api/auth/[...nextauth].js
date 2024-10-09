import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const BASE_URL = process.env.API_BASE_URL
const JWT_SECRET = process.env.JWT_SECRET

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      async authorize(credentials) {
        try {
          const res = await fetch(`${BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: credentials.name,
              password: credentials.password,
            }),
            credentials: 'include',
          })

          const user = await res.json()

          if (res.ok && user) {
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
    jwt: true,
  },
  jwt: {
    secret: JWT_SECRET,
    encryption: true,
  },
})