import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const getAllCategories = async (token) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/categories`, token)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching categories:', error)
    throw new Error('An error occurred while fetching categories')
  }
}

export const createCategory = async (token, categoryData) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/categories`, token, {
      method: 'POST',
      body: JSON.stringify(categoryData),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating category:', error)
    throw new Error('An error occurred while creating category')
  }
}

export const getCategoryById = async (token, categoryId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/categories/${categoryId}`,
      token,
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching category:', error)
    throw new Error('An error occurred while fetching category')
  }
}

// Função para atualizar uma categoria
export const updateCategory = async (token, categoryId, categoryData) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/categories/${categoryId}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(categoryData),
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating category:', error)
    throw new Error('An error occurred while updating category')
  }
}

// Função para apagar uma categoria
export const deleteCategory = async (token, categoryId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/categories/${categoryId}`,
      token,
      {
        method: 'DELETE',
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting category:', error)
    throw new Error('An error occurred while deleting category')
  }
}
