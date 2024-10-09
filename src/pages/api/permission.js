import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const getAllPermissions = async (token) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/permissions`, token)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching permissions:', error)
    throw new Error('An error occurred while fetching permissions')
  }
}

export const createPermission = async (token, permissionData) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/permissions`, token, {
      method: 'POST',
      body: JSON.stringify(permissionData),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating permission:', error)
    throw new Error('An error occurred while creating permission')
  }
}

export const getPermissionById = async (token, permissionId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/permissions/${permissionId}`,
      token,
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching permission:', error)
    throw new Error('An error occurred while fetching permission')
  }
}

// Função para atualizar uma permissão
export const updatePermission = async (token, permissionId, permissionData) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/permissions/${permissionId}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(permissionData),
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating permission:', error)
    throw new Error('An error occurred while updating permission')
  }
}

// Função para apagar uma permissão
export const deletePermission = async (token, permissionId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/permissions/${permissionId}`,
      token,
      {
        method: 'DELETE',
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting permission:', error)
    throw new Error('An error occurred while deleting permission')
  }
}
