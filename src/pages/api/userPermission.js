import { fetchWithAuth } from '@/pages/api/auth-token'
const BASE_URL = process.env.API_BASE_URL

export const checkUserPermission = async (token, databody) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/userpermissions`, token, {
      method: 'POST',
      body: JSON.stringify(databody),
    })
    if (response.status === 200) {
      const data = await response.json()
      console.log(data)
      return data
    }
    return { hasAccess: false }
  } catch (error) {
    console.error('Error checking permissions:', error)
    return { hasAccess: false }
  }
}
