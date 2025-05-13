'use client'

import z from 'zod'
import { Product } from '@/server/backoffice/types/Product'
import { useState } from 'react'

export default function ProductPage() {
  const [editing, isEditing] = useState(false)
  return (
      <div className="">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">
          Adicionar Produto
        </h1>
        <form className="space-y-6">
        <div>
            <label
              htmlFor="productName"
              className="block text-sm font-medium text-gray-700"
            >
              Imagem do Produto
            </label>
            <input
              type="text"
              id="productName"
              className="mt-1 p-2 block w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o nome do produto"
              required
            />
          </div>

          <div>
            <label
              htmlFor="productName"
              className="block text-sm font-medium text-gray-700"
            >
              Nome do Produto
            </label>
            <input
              type="text"
              id="productName"
              className="mt-1 p-2 block w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o nome do produto"
              required
            />
          </div>

          {/* Preço */}
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-gray-700"
            >
              Preço
            </label>
            <input
              type="number"
              id="price"
              className="mt-1 p-2 block w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite o preço do produto"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Descrição
            </label>
            <textarea
              id="description"
              rows={4}
              className="mt-1 p-2 block w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Digite a descrição do produto"
              required
            ></textarea>
          </div>

          {/* Botão de Enviar */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-6 py-2 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            >
              Adicionar Produto
            </button>
          </div>
        </form>
      </div>
  )
}
