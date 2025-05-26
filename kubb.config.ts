import { defineConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import 'dotenv/config'

// yarn add @kubb/core axios @kubb/cli @kubb/plugin-oas @kubb/plugin-ts @kubb/plugin-react-query @kubb/plugin-client @tanstack/react-query

const configs = [
  defineConfig({
    name: 'Backoffice',
    root: '.',
    input: {
      path: `${process.env.NEXT_PUBLIC_API_BASE_URL}-docs/backoffice.json`, // URL do Swagger ou OpenAPI
    },
    output: {
      path: './src/servers/backoffice',
      extension: {
        '.ts': '.js',
      },
    },
    plugins: [
      pluginOas(), // Processa o OpenAPI/Swagger
      pluginTs(), // Gera tipos TypeScript
      pluginReactQuery({
        client: {
          baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
        },
      }), // Gera hooks para React Query
    ],
  }),
]

export default configs
