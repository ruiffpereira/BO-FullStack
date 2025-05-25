const routes = {
  login: '/admin',
  dashboard: '/dashboard',
  ecommerce: '/ecommerce',
  addProduct: '/ecommerce/addproduct',
  product: '/ecommerce/product/',
  productEdit: (id: string) => `/ecommerce/product/${id}/edit`,
}

export default routes
