import axios from 'axios'

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r.data,
  (err) => Promise.reject(err)
)

export const tablesAPI = {
  getAll:         ()         => api.get('/tables'),
  getById:        (id)       => api.get(`/tables/${id}`),
  create:         (data)     => api.post('/tables', data),
  update:         (id, data) => api.patch(`/tables/${id}`, data),
  updateStatus:   (id, s)    => api.patch(`/tables/${id}/status`, { status: s }),
  updatePosition: (id, x, y) => api.patch(`/tables/${id}/position`, { pos_x: x, pos_y: y }),
  delete:         (id)       => api.delete(`/tables/${id}`),
}

export const ordersAPI = {
  getAll:       (params) => api.get('/orders', { params }),
  getById:      (id)     => api.get(`/orders/${id}`),
  create:       (data)   => api.post('/orders', data),
  addItems:     (id, d)  => api.post(`/orders/${id}/items`, d),
  updateItems:  (id, d)  => api.patch(`/orders/${id}/items`, d),
  updateStatus: (id, s)  => api.patch(`/orders/${id}/status`, { status: s }),
  requestBill:  (id)     => api.post(`/orders/${id}/bill-request`),
  markBarReady: (id)     => api.post(`/orders/${id}/bar-ready`),
}

export const productsAPI = {
  getAll:             (params) => api.get('/products', { params }),
  getExtras:          ()       => api.get('/products/extras'),
  getById:            (id)     => api.get(`/products/${id}`),
  create:             (data)   => api.post('/products', data),
  update:             (id, d)  => api.patch(`/products/${id}`, d),
  toggleAvailability: (id)     => api.patch(`/products/${id}/availability`),
  adjustPrices:       (data)   => api.post('/products/adjust-prices', data),
}

export const paymentsAPI = {
  create:         (data) => api.post('/payments', data),
  getCashClosing: (date) => api.get('/payments/cash-closing', { params: { date } }),
}

export const cartaAPI = {
  pdfUrl:  (type) => `${API_BASE_URL}/carta/pdf${type ? `?type=${type}` : ''}`,
  htmlUrl: (type) => `${API_BASE_URL}/carta/html${type ? `?type=${type}` : ''}`,
}

export const customersAPI = {
  getAll:  (params) => api.get('/customers', { params }),
  create:  (data)   => api.post('/customers', data),
  update:  (id, d)  => api.patch(`/customers/${id}`, d),
}

export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  updatePassword: (id, password) => api.patch(`/users/${id}/password`, { password }),
  delete: (id) => api.delete(`/users/${id}`),
}

export const metricsAPI = {
  getSummary: (date)        => api.get('/metrics/summary', { params: { date } }),
  getMonthly: (month, year) => api.get('/metrics/monthly', { params: { month, year } }),
}

export const staffAPI = {
  clockIn:       ()              => api.post('/staff/clock-in'),
  clockOut:      ()              => api.post('/staff/clock-out'),
  getShifts:     (uid, m, y)    => api.get(`/staff/shifts/${uid}`, { params: { month: m, year: y } }),
  getPayments:   (m, y)         => api.get('/staff/payments', { params: { month: m, year: y } }),
  createPayment: (data)          => api.post('/staff/payments', data),
}

export const historialAPI = {
  getAll:     (params) => api.get('/historial', { params }),
  getById:    (id)     => api.get(`/historial/${id}`),
  getWaiters: ()       => api.get('/historial/waiters/list'),
}

export const auditoriaAPI = {
  get: (userId, params) => api.get(`/auditoria/${userId}`, { params }),
}

export default api
