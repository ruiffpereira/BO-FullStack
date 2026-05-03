const routes = {
  login: '/admin',
  dashboard: '/dashboard',
  ecommerce: '/ecommerce',
  addProduct: '/ecommerce/addproduct',
  product: '/ecommerce/product/',
  productEdit: (id: string) => `/ecommerce/product/${id}/edit`,
  customer: (id: string) => `/customers/${id}`,
  orders: '/orders',
  ordersCustomerId: (customerId: string) => `/orders/${customerId}`,
  categories: '/ecommerce/categories',
  schedule: '/schedule',
  scheduleServices: '/schedule/services',
  scheduleSettings: '/schedule/settings',
  management: '/management',
}

export default routes
