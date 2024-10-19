import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const checkUserPermission = async (token, databody) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/userpermissions`, token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(databody),
    })

    if (response.status === 200) {
      const data = await response.json()
      return data
    } else {
      console.error('Failed to check permissions:', response.statusText)
      return null
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    return { message: error.message, stack: error.stack }
  }
}
