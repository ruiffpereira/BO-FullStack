import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const getAllOrders = async (token) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/orders`, token, {
      method: 'GET',
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching orders:', error)
    throw new Error('An error occurred while fetching orders')
  }
}

export const createOrder = async (token, orderData) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/orders`, token, {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating order:', error)
    throw new Error('An error occurred while creating order')
  }
}

export const getOrderById = async (token, orderId) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/orders/${orderId}`, token)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching order:', error)
    throw new Error('An error occurred while fetching order')
  }
}

export const getOrderCustomerId = async (token, orderId) => {
  try {
    // console.log(orderId)
    const response = await fetchWithAuth(
      `${BASE_URL}/orders/customerid/${orderId}`,
      token,
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching order:', error)
    throw new Error('An error occurred while fetching order')
  }
}

// Função para atualizar um pedido
export const updateOrder = async (token, orderId, orderData) => {
  try {
    const response = await fetch(`${BASE_URL}/orders/${orderId}`, token, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating order:', error)
    throw new Error('An error occurred while updating order')
  }
}

// Função para apagar um pedido
export const deleteOrder = async (token, orderId) => {
  try {
    const response = await fetch(`${BASE_URL}/orders/${orderId}`, token, {
      method: 'DELETE',
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting order:', error)
    throw new Error('An error occurred while deleting order')
  }
}