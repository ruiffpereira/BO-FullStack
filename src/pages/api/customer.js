import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const getAllCustomers = async (token) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/customers`, token, {
      method: 'GET',
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching customers:', error)
    throw new Error('An error occurred while fetching customers')
  }
}

export const createCustomer = async (token, customerData) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/customers`, token, {
      method: 'POST',
      body: JSON.stringify(customerData),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating customer:', error)
    throw new Error('An error occurred while creating customer')
  }
}

export const getCustomerById = async (token, customerId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/customers/${customerId}`,
      token,
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching customer:', error)
    throw new Error('An error occurred while fetching customer')
  }
}

// Função para atualizar um cliente
export const updateCustomer = async (token, customerId, customerData) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/customers/${customerId}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(customerData),
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating customer:', error)
    throw new Error('An error occurred while updating customer')
  }
}

// Função para apagar um cliente
export const deleteCustomer = async (token, customerId) => {
  try {
    const response = await fetchWithAuth(
      `${BASE_URL}/customers/${customerId}`,
      token,
      {
        method: 'DELETE',
      },
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting customer:', error)
    throw new Error('An error occurred while deleting customer')
  }
}
