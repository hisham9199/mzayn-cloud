import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
})

// إرفاق التوكن تلقائياً مع كل طلب
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('mzayn_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export const authApi = {
    getLoginUrl: () => api.get('/auth/discord/login'),
    getMe: () => api.get('/auth/me'),
}

export const stableApi = {
    list: () => api.get('/stables/'),
    create: (data: any) => api.post('/stables/', data),
    update: (id: number, data: any) => api.put(`/stables/${id}`, data),
    delete: (id: number) => api.delete(`/stables/${id}`),
}

export const camelApi = {
    list: (params?: any) => api.get('/camels/', { params }),
    get: (id: number) => api.get(`/camels/${id}`),
    create: (data: any) => api.post('/camels/', data),
    update: (id: number, data: any) => api.put(`/camels/${id}`, data),
    delete: (id: number) => api.delete(`/camels/${id}`),
    uploadImage: (id: number, file: File) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post(`/camels/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    audit: (id: number) => api.get(`/camels/${id}/audit`),
    test: (id: number, championshipId: number) => api.post(`/camels/${id}/test?championship_id=${championshipId}`),
    analyze: (stableId: number, championshipId?: number) =>
        api.get(`/camels/analysis/stable/${stableId}`, { params: { championship_id: championshipId } }),
    bulkAssign: (data: { camel_ids: number[]; stable_id?: number; new_stable_name?: string; status?: string }) =>
        api.post('/camels/bulk-assign', data),
    bulkDelete: (data: { camel_ids: number[] }) =>
        api.post('/camels/bulk-delete', data),
}

export const championshipApi = {
    list: () => api.get('/championships/'),
    create: (data: any) => api.post('/championships/', data),
    update: (id: number, data: any) => api.put(`/championships/${id}`, data),
    delete: (id: number) => api.delete(`/championships/${id}`),
    optimize: (id: number, body: any) => api.post(`/championships/${id}/optimize`, body),
    results: (id: number) => api.get(`/championships/${id}/results`),
}

export const ocrApi = {
    single: (file: File) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/ocr/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    bulk: (files: File[]) => {
        const fd = new FormData(); files.forEach(f => fd.append('files', f))
        return api.post('/ocr/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    zip: (file: File) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/ocr/bulk-zip', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    pdf: (file: File) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/ocr/pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
}

export const excelApi = {
    export: (params?: any) => api.get('/excel/export', { params, responseType: 'blob' }),
    import: (file: File, stableId?: number) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/excel/import', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: { stable_id: stableId }
        })
    },
}

export const dashboardApi = {
    stats: () => api.get('/dashboard/stats'),
}

export const backupApi = {
    create: () => api.post('/backup'),
}
