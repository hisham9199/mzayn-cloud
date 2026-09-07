import React, { useState } from 'react'
import { authApi } from '../api/client'
import toast from 'react-hot-toast'

export default function Login({ error }: { error?: string | null }) {
    const [loading, setLoading] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        try {
            const res = await authApi.getLoginUrl()
            if (res.data?.url) {
                window.location.href = res.data.url
            }
        } catch (e: any) {
            toast.error('تعذر الاتصال بديسكورد، يرجى المحاولة لاحقاً')
            setLoading(false)
        }
    }

    const getErrorMessage = () => {
        if (!error) return null
        switch (error) {
            case 'not_in_server':
                return 'عذراً، يجب أن تكون عضواً داخل سيرفر الديسكورد للدخول إلى المنصة.'
            case 'no_permission_role':
                return 'عذراً، لا تمتلك رتبة مصرح لها بالدخول (Admin أو BasicUser). يرجى التواصل مع الإدارة.'
            case 'discord_token_failed':
                return 'فشل التحقق من جلسة ديسكورد، يرجى إعادة المحاولة.'
            default:
                return 'حدث خطأ أثناء تسجيل الدخول عبر ديسكورد.'
        }
    }

    const errorMsg = getErrorMessage()

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)',
            padding: '1.5rem',
            fontFamily: 'inherit',
            direction: 'rtl'
        }}>
            <div style={{
                maxWidth: 460,
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '1.25rem',
                padding: '2.5rem 2rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                textAlign: 'center',
            }}>
                {/* Logo / Badge */}
                <div style={{
                    width: 72,
                    height: 72,
                    margin: '0 auto 1.5rem',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '2px solid #3b82f6',
                    borderRadius: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.25rem'
                }}>
                    🐪
                </div>

                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
                    نظام مزاين الذكي
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                    المنصة المتقدمة لإدارة النياق وحساب بطولات مزاين بالذكاء الاصطناعي
                </p>

                {errorMsg && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        padding: '0.85rem 1rem',
                        borderRadius: '0.75rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        textAlign: 'right',
                        lineHeight: 1.5
                    }}>
                        ⚠️ {errorMsg}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.95rem 1.5rem',
                        background: '#5865F2',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 14px rgba(88, 101, 242, 0.4)'
                    }}
                    onMouseOver={(e) => !loading && (e.currentTarget.style.background = '#4752C4')}
                    onMouseOut={(e) => !loading && (e.currentTarget.style.background = '#5865F2')}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    {loading ? 'جاري الاتصال...' : 'تسجيل الدخول عبر ديسكورد'}
                </button>

                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', color: '#64748b', fontSize: '0.8rem' }}>
                    الدخول متاح فقط للأعضاء الذين يملكون رتبة مصرح لها في السيرفر الرسمي
                </div>
            </div>
        </div>
    )
}
