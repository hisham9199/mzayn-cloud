export const ATTRIBUTES = ['neck', 'lips', 'nose', 'head', 'eyelashes', 'ear', 'hump'] as const
export type AttributeKey = typeof ATTRIBUTES[number]

export const ATTR_NAMES: Record<AttributeKey, string> = {
    nose: 'الأنف',
    lips: 'الشفاه',
    head: 'الرأس',
    neck: 'الرقبة',
    hump: 'السنام',
    eyelashes: 'الرموش',
    ear: 'الأذن',
}

export interface Camel {
    id: number
    number: string
    name?: string
    gender?: string
    color?: string
    stable_id?: number
    stable_name?: string
    owner?: string
    points?: number
    spacing?: number
    harmony?: number
    nose?: number
    lips?: number
    head?: number
    neck?: number
    hump?: number
    eyelashes?: number
    ear?: number
    is_valid: boolean
    points_valid: boolean
    spacing_valid: boolean
    needs_review: boolean
    ocr_confidence?: number
    image_path?: string
    acquisition_date?: string
    status: string
    notes?: string
    created_at: string
    updated_at: string
    expected_points?: number
    expected_spacing?: number
}

export interface Stable {
    id: number
    name: string
    description?: string
    camel_count?: number
    created_at: string
    discord_user_id?: string
    discord_username?: string
}

export interface Championship {
    id: number
    name: string
    stable_id?: number
    stable_name?: string
    min_camels: number
    max_camels: number
    max_points_per_camel?: number
    required_spacing?: number
    mandatory_camel_ids: number[]
    excluded_camel_ids: number[]
    allow_males: boolean
    allow_other_stables: boolean
    created_at: string
}

export interface OptimizeRequest {
    current_camel_ids?: number[]
    time_limit_seconds?: number
    required_spacing?: number | null
    optimization_goal?: 'balanced' | 'min_spacing' | 'max_points'
}

export interface OptimizeResult {
    solve_status: string
    num_camels?: number
    total_points?: number
    final_spacing?: number
    attr_sums?: Record<string, number>
    solve_time_ms?: number
    selected_camel_ids?: number[]
    selected_camels?: Camel[]
    current_total_points?: number
    improvement?: number
    camels_to_remove?: number[]
    camels_to_add?: number[]
    optimization_goal?: string
    required_spacing?: number | null
    message?: string
}

export const STATUS_LABELS: Record<string, string> = {
    available: 'متوفرة',
    sold: 'مباعة',
    unavailable: 'غير متوفرة',
    reserved: 'محجوزة',
}

export const STATUS_COLORS: Record<string, string> = {
    available: '#22c55e',
    sold: '#ef4444',
    unavailable: '#f97316',
    reserved: '#eab308',
}

export const GENDER_OPTIONS = ['ذكر', 'أنثى']

export function computeExpected(camel: Partial<Camel>) {
    const attrs = ATTRIBUTES.map(a => camel[a] ?? 0)
    if (attrs.some(v => !v || v <= 0)) return { expectedPoints: null, expectedSpacing: null }
    const expectedPoints = attrs.reduce((a, b) => a + b, 0)
    const expectedSpacing = Math.max(...attrs) - Math.min(...attrs)
    return { expectedPoints, expectedSpacing }
}

export function getValidationStatus(camel: Partial<Camel>) {
    const { expectedPoints, expectedSpacing } = computeExpected(camel)
    if (expectedPoints === null) return 'incomplete'
    const pointsOk = camel.points === expectedPoints
    const spacingOk = camel.spacing === expectedSpacing
    if (pointsOk && spacingOk) return 'valid'
    return 'invalid'
}
