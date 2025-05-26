const routes = {
  login: '/admin',
  dashboard: '/dashboard',
  ecommerce: '/ecommerce',
  addProduct: '/ecommerce/addproduct',
  product: '/ecommerce/product/',
  productEdit: (id: string) => `/ecommerce/product/${id}/edit`,
  customer: (id: string) => `/customers/${id}`,
}

export default routes
