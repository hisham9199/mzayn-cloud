import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { ocrApi, camelApi, stableApi } from '../api/client'
import { ATTR_NAMES, ATTRIBUTES, Stable } from '../types'

interface ExtractedCamelItem {
    filename: string
    fileIndex: number
    result: any
    status: 'success' | 'error'
    errorMsg?: string
}

// ضغط وتصغير الصور الكبيرة في المتصفح قبل إرسالها لسرعة فائقة وتوفير الحجم
async function optimizeImageForOcr(file: File, maxDimension = 1600, quality = 0.85): Promise<File> {
    if (!file.type.startsWith('image/') || file.size < 400 * 1024) {
        return file // أقل من 400KB لا يحتاج ضغط
    }
    return new Promise((resolve) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            let { width, height } = img
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width)
                    width = maxDimension
                } else {
                    width = Math.round((width * maxDimension) / height)
                    height = maxDimension
                }
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(file)
                return
            }
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, width, height)
            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) {
                        resolve(file)
                        return
                    }
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }))
                },
                'image/jpeg',
                quality
            )
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(file)
        }
        img.src = url
    })
}

export default function BulkImport() {
    const qc = useQueryClient()
    const [files, setFiles] = useState<File[]>([])
    const [zipFile, setZipFile] = useState<File | null>(null)
    const [pdfFile, setPdfFile] = useState<File | null>(null)

    const [isProcessing, setIsProcessing] = useState(false)
    const [currentProgress, setCurrentProgress] = useState({
        current: 0,
        total: 0,
        percent: 0,
        currentFilename: '',
    })

    const [liveResults, setLiveResults] = useState<ExtractedCamelItem[]>([])
    const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
    const [targetStableId, setTargetStableId] = useState<string>('')
    const [editingRow, setEditingRow] = useState<number | null>(null)
    const stopSignalRef = useRef(false)

    // Update a single field value for a row (for inline editing)
    const updateResultField = (rowIdx: number, field: string, value: string) => {
        setLiveResults(prev => prev.map((item, i) => {
            if (i !== rowIdx) return item
            const newResult = { ...item.result }
            newResult[field] = { ...(newResult[field] || {}), value, confidence: 1.0, status: 'green' }
            // Recalculate points and spacing if an attribute changed
            const attrFields = ['nose','lips','head','neck','hump','eyelashes','ear']
            const vals = attrFields.map(a => parseInt(newResult[a]?.value || '0')).filter(v => v > 0)
            if (vals.length === 7) {
                const sum = vals.reduce((a, b) => a + b, 0)
                const sp = Math.max(...vals) - Math.min(...vals)
                newResult['points'] = { value: String(sum), confidence: 1.0, status: 'green' }
                newResult['spacing'] = { value: String(sp), confidence: 1.0, status: 'green' }
                newResult['validation_ok'] = true
                newResult['overall_status'] = 'green'
                newResult['expected_points'] = sum
                newResult['expected_spacing'] = sp
            }
            return { ...item, result: newResult }
        }))
    }

    // Check if a field needs user attention (missing, low confidence, or yellow/red status)
    const fieldNeedsReview = (fieldObj: any) => {
        if (!fieldObj || !fieldObj.value) return true
        if (fieldObj.status === 'red') return true
        if (fieldObj.status === 'yellow') return true
        if (typeof fieldObj.confidence === 'number' && fieldObj.confidence < 0.70) return true
        return false
    }

    // Check if a result row has any attribute that needs review
    const rowNeedsReview = (r: any) => {
        if (!r) return true
        if (r.overall_status === 'red') return true
        const attrFields = ['nose','lips','head','neck','hump','eyelashes','ear']
        return attrFields.some(a => fieldNeedsReview(r[a]))
    }

    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))

    const handleFiles = (fileList: FileList) => {
        const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'))
        setFiles(imageFiles)
        setZipFile(null)
        setPdfFile(null)
        setLiveResults([])
        setSelectedResults(new Set())
    }

    const handleZip = (fileList: FileList) => {
        const zip = Array.from(fileList).find(f => f.name.endsWith('.zip'))
        if (zip) {
            setZipFile(zip)
            setFiles([])
            setPdfFile(null)
            setLiveResults([])
            setSelectedResults(new Set())
        }
    }

    const handlePdf = (fileList: FileList) => {
        const pdf = Array.from(fileList).find(f => f.name.endsWith('.pdf'))
        if (pdf) {
            setPdfFile(pdf)
            setFiles([])
            setZipFile(null)
            setLiveResults([])
            setSelectedResults(new Set())
        }
    }

    // Sequential Processing with Real-time Progress Bar
    const startProcessing = async () => {
        stopSignalRef.current = false
        setIsProcessing(true)
        setLiveResults([])
        setSelectedResults(new Set())

        // 1. Multiple image files (معالجة متوازية فائقة السرعة)
        if (files.length > 0) {
            const total = files.length
            const newResults: ExtractedCamelItem[] = new Array(total)
            let completedCount = 0
            const CONCURRENCY = 3 // معالجة 3 صور بالتوازي في نفس اللحظة

            const processSingleFile = async (rawFile: File, index: number) => {
                if (stopSignalRef.current) return
                try {
                    // ضغط وتحسين الصورة تلقائياً لتقليل وقت الرفع من ثوانٍ إلى أجزاء من الثانية
                    const file = await optimizeImageForOcr(rawFile)
                    const res = await ocrApi.single(file)
                    const item: ExtractedCamelItem = {
                        filename: rawFile.name,
                        fileIndex: index + 1,
                        result: res.data,
                        status: 'success',
                    }
                    newResults[index] = item
                    setLiveResults([...newResults.filter(Boolean)])

                    if (res.data?.validation_ok || res.data?.overall_status === 'green') {
                        setSelectedResults(prev => new Set([...prev, index]))
                    }
                } catch (err: any) {
                    newResults[index] = {
                        filename: rawFile.name,
                        fileIndex: index + 1,
                        result: null,
                        status: 'error',
                        errorMsg: 'تعذّر استخراج البيانات من الصورة',
                    }
                    setLiveResults([...newResults.filter(Boolean)])
                } finally {
                    completedCount++
                    setCurrentProgress({
                        current: completedCount,
                        total: total,
                        percent: Math.round((completedCount / total) * 100),
                        currentFilename: rawFile.name,
                    })
                }
            }

            for (let i = 0; i < total; i += CONCURRENCY) {
                if (stopSignalRef.current) {
                    toast('تم إيقاف الاستيراد', { icon: '⏹️' })
                    break
                }
                const chunk = files.slice(i, i + CONCURRENCY).map((file, offset) => processSingleFile(file, i + offset))
                await Promise.all(chunk)
                // تأخير بسيط بين الدفعات لحماية الحساب من تجاوز معدل OpenAI API Rate Limits
                if (i + CONCURRENCY < total) {
                    await new Promise(r => setTimeout(r, 400))
                }
            }
            toast.success(`اكتملت معالجة ${newResults.filter(Boolean).length} صورة! 🐪`)
        }
        // 2. ZIP file
        else if (zipFile) {
            setCurrentProgress({ current: 1, total: 1, percent: 50, currentFilename: zipFile.name })
            try {
                const res = await ocrApi.zip(zipFile)
                const items: ExtractedCamelItem[] = (res.data?.results || []).map((r: any, idx: number) => ({
                    filename: r.filename || `ملف ${idx + 1}`,
                    fileIndex: idx + 1,
                    result: r,
                    status: 'success',
                }))
                setLiveResults(items)
                setSelectedResults(new Set(items.map((_, i) => i)))
                setCurrentProgress({ current: 1, total: 1, percent: 100, currentFilename: zipFile.name })
                toast.success(`اكتمل استخراج ملف ZIP (${items.length} صورة)`)
            } catch {
                toast.error('فشل استخراج ملف ZIP')
            }
        }
        // 3. PDF file
        else if (pdfFile) {
            setCurrentProgress({ current: 1, total: 1, percent: 50, currentFilename: pdfFile.name })
            try {
                const res = await ocrApi.pdf(pdfFile)
                const items: ExtractedCamelItem[] = (res.data?.results || []).map((r: any, idx: number) => ({
                    filename: r.filename || `صفحة ${idx + 1}`,
                    fileIndex: idx + 1,
                    result: r,
                    status: 'success',
                }))
                setLiveResults(items)
                setSelectedResults(new Set(items.map((_, i) => i)))
                setCurrentProgress({ current: 1, total: 1, percent: 100, currentFilename: pdfFile.name })
                toast.success(`اكتمل استخراج ملف PDF (${items.length} صفحة)`)
            } catch {
                toast.error('فشل استخراج ملف PDF')
            }
        }

        setIsProcessing(false)
    }

    const stopProcessing = () => {
        stopSignalRef.current = true
        setIsProcessing(false)
    }

    // إعادة معالجة صورة واحدة محددة في حال الفشل
    const retrySingleFile = async (index: number) => {
        const rawFile = files[index]
        if (!rawFile) return
        toast('جاري إعادة قراءة الصورة...', { icon: '🔄' })
        try {
            const file = await optimizeImageForOcr(rawFile)
            const res = await ocrApi.single(file)
            setLiveResults(prev => {
                const copy = [...prev]
                copy[index] = {
                    filename: rawFile.name,
                    fileIndex: index + 1,
                    result: res.data,
                    status: 'success',
                }
                return copy
            })
            if (res.data?.validation_ok || res.data?.overall_status === 'green') {
                setSelectedResults(prev => new Set([...prev, index]))
            }
            toast.success(`تمت إعادة قراءة ${rawFile.name} بنجاح!`)
        } catch {
            toast.error(`تعذر استخراج بيانات ${rawFile.name}`)
        }
    }

    // Save selected camels to DB
    const saveMutation = useMutation(async () => {
        if (!targetStableId) {
            toast.error('يرجى اختيار المنقية أولاً لحفظ النياق بها ⚠️')
            throw new Error('لم يتم تحديد المنقية')
        }

        const toSave = liveResults.filter((_, i) => selectedResults.has(i) && _.status === 'success')
        let saved = 0

        for (const item of toSave) {
            const r = item.result
            if (!r) continue
            try {
                const data: any = {
                    number: r.number?.value || r.name?.value || `ناقة ${saved + 1}`,
                    name: r.name?.value || undefined,
                    color: r.color?.value || undefined,
                    stable_id: parseInt(targetStableId),
                    points: r.points?.value ? parseInt(r.points.value) : undefined,
                    spacing: r.spacing?.value !== undefined && r.spacing?.value !== '' ? parseInt(r.spacing.value) : undefined,
                }
                ATTRIBUTES.forEach(attr => {
                    const val = r[attr]?.value
                    if (val) data[attr] = parseInt(val)
                })
                data.needs_review = !r.validation_ok
                await camelApi.create(data)
                saved++
            } catch {
                // continue with next
            }
        }
        return saved
    }, {
        onSuccess: (count) => {
            qc.invalidateQueries('camels')
            qc.invalidateQueries('stables')
            toast.success(`تم حفظ ${count} ناقة بنجاح في قاعدة البيانات`)
        },
        onError: () => {
            toast.error('حدث خطأ أثناء حفظ النياق')
        },
    })

    const getStatusStyle = (s: string) => ({
        green: { color: 'var(--success)', label: 'صحيح 100%' },
        yellow: { color: 'var(--warning)', label: 'مراجعة' },
        red: { color: 'var(--danger)', label: 'خطأ' },
    }[s] || { color: 'var(--text-muted)', label: '—' })

    const totalSelected = selectedResults.size
    const successfulCount = liveResults.filter(r => r.result?.overall_status === 'green' || r.result?.validation_ok).length
    const reviewCount = liveResults.filter(r => r.result?.overall_status === 'yellow' || (r.status === 'success' && !r.result?.validation_ok)).length
    const errorCount = liveResults.filter(r => r.status === 'error' || r.result?.overall_status === 'red').length

    return (
        <div className="animate-fadeIn">
            <div className="page-top">
                <div>
                    <h1>استيراد جماعي من الصور</h1>
                    <p className="page-subtitle">رفع مجموعة صور ومتابعة استخراج البيانات في الوقت الفعلي</p>
                </div>
            </div>

            {/* Upload Area */}
            <div className="grid-3" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Images upload */}
                <div className="card" style={files.length > 0 ? { borderColor: 'var(--primary-medium)', background: 'var(--primary-light)' } : {}}>
                    <h4 style={{ color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18,color:'var(--primary)'}}>
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        صور متعددة
                    </h4>
                    <div className="dropzone" style={{ padding: '1.25rem' }}
                        onClick={() => document.getElementById('bulk-images')?.click()}>
                        <input id="bulk-images" type="file" multiple accept="image/*" style={{ display: 'none' }}
                            onChange={e => e.target.files && handleFiles(e.target.files)} />
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:40,height:40,color:'var(--primary)'}}>
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                        </div>
                        <p style={{ color: files.length > 0 ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: files.length > 0 ? 700 : 400, textAlign: 'center' }}>
                            {files.length > 0 ? `تم اختيار ${files.length} صورة` : 'انقر لاختيار عدة صور'}
                        </p>
                    </div>
                </div>

                {/* ZIP upload */}
                <div className="card" style={zipFile ? { borderColor: 'var(--primary-medium)', background: 'var(--primary-light)' } : {}}>
                    <h4 style={{ color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18,color:'var(--primary)'}}>
                            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                        </svg>
                        ملف مضغوط ZIP
                    </h4>
                    <div className="dropzone" style={{ padding: '1.25rem' }}
                        onClick={() => document.getElementById('bulk-zip')?.click()}>
                        <input id="bulk-zip" type="file" accept=".zip" style={{ display: 'none' }}
                            onChange={e => e.target.files && handleZip(e.target.files)} />
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:40,height:40,color:'var(--primary)'}}>
                                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                            </svg>
                        </div>
                        <p style={{ color: zipFile ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: zipFile ? 700 : 400, textAlign: 'center' }}>
                            {zipFile ? zipFile.name : 'اختيار ملف ZIP يحتوي على صور'}
                        </p>
                    </div>
                </div>

                {/* PDF upload */}
                <div className="card" style={pdfFile ? { borderColor: 'var(--primary-medium)', background: 'var(--primary-light)' } : {}}>
                    <h4 style={{ color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18,color:'var(--primary)'}}>
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        مستند PDF
                    </h4>
                    <div className="dropzone" style={{ padding: '1.25rem' }}
                        onClick={() => document.getElementById('bulk-pdf')?.click()}>
                        <input id="bulk-pdf" type="file" accept=".pdf" style={{ display: 'none' }}
                            onChange={e => e.target.files && handlePdf(e.target.files)} />
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:40,height:40,color:'var(--primary)'}}>
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                        <p style={{ color: pdfFile ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: pdfFile ? 700 : 400, textAlign: 'center' }}>
                            {pdfFile ? pdfFile.name : 'اختيار ملف PDF'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {!isProcessing ? (
                    <button
                        className="btn btn-primary btn-lg"
                        style={{ flex: 1, justifyContent: 'center', gap: '0.5rem' }}
                        onClick={startProcessing}
                        disabled={files.length === 0 && !zipFile && !pdfFile}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        بدء استخراج وقراءة ({files.length || (zipFile ? 1 : (pdfFile ? 1 : 0))}) صور تلقائياً
                    </button>
                ) : (
                    <button
                        className="btn btn-danger btn-lg"
                        style={{ flex: 1, justifyContent: 'center', gap: '0.5rem' }}
                        onClick={stopProcessing}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                        </svg>
                        إيقاف المعالجة
                    </button>
                )}
            </div>

            {/* Real-time Progress Bar */}
            {(isProcessing || currentProgress.total > 0) && (
                <div className="card" style={{
                    marginBottom: '1.5rem',
                    borderColor: isProcessing ? 'var(--primary-medium)' : 'var(--success-medium)',
                    background: isProcessing ? 'var(--primary-light)' : 'var(--success-light)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div>
                            <h3 style={{ color: isProcessing ? 'var(--primary)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                                {isProcessing ? (
                                    <><div className="spinner" style={{width:16,height:16}} /> جاري المعالجة والاستخراج...</>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                        اكتملت عملية الاستخراج
                                    </>
                                )}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                {isProcessing && currentProgress.currentFilename && (
                                    <>جاري قراءة: <strong style={{ color: 'var(--text)' }}>{currentProgress.currentFilename}</strong></>
                                )}
                            </p>
                        </div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: isProcessing ? 'var(--primary)' : 'var(--success)' }}>
                            {currentProgress.percent}%
                        </span>
                    </div>

                    <div style={{ width: '100%', height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                            width: `${currentProgress.percent}%`,
                            height: '100%',
                            background: isProcessing
                                ? 'linear-gradient(90deg, var(--primary-hover), var(--primary))'
                                : 'var(--success)',
                            borderRadius: 99,
                            transition: 'width 0.3s ease-in-out',
                        }} />
                    </div>

                    {/* Progress details stats */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>تم إنجاز: <strong style={{ color: 'var(--success)' }}>{currentProgress.current}</strong> من <strong>{currentProgress.total}</strong></span>
                        <span>متبقي: <strong style={{ color: 'var(--warning)' }}>{Math.max(0, currentProgress.total - currentProgress.current)}</strong></span>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {liveResults.length > 0 && (
                <>
                    {/* Summary Badges */}
                    <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
                        {[
                            { label: 'إجمالي الصور المعالجة', value: liveResults.length, color: 'var(--info)', bg: 'var(--info-light)' },
                            { label: 'صحيحة 100%', value: successfulCount, color: 'var(--success)', bg: 'var(--success-light)' },
                            { label: 'تحتاج مراجعة', value: reviewCount, color: 'var(--warning)', bg: 'var(--warning-light)' },
                            { label: 'أخطاء في القراءة', value: errorCount, color: 'var(--danger)', bg: 'var(--danger-light)' },
                        ].map(s => (
                            <div key={s.label} style={{ textAlign: 'center', padding: '0.85rem', background: s.bg, borderRadius: 'var(--radius-sm)', border: `1px solid ${s.color}30` }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Warning banner for rows needing review */}
                    {liveResults.some(item => item.result && rowNeedsReview(item.result)) && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            padding: '0.85rem 1.1rem', marginBottom: '1rem',
                            background: 'var(--warning-light)',
                            border: '1.5px solid var(--warning-medium)',
                            borderRadius: 'var(--radius-sm)',
                        }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,color:'var(--warning)',flexShrink:0}}>
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: '0.25rem' }}>
                                    يوجد صفات لم يتم قراءتها بشكل صحيح
                                </div>
                                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                    الخلايا ذات <strong style={{ color: 'var(--warning)' }}>الخلفية الصفراء</strong> تحتاج مراجعة يدوية — اضغط زر <strong>صحّح</strong> لتعديل القيم قبل الحفظ.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action & Save Controls */}
                    <div className="card" style={{
                        marginBottom: '1rem',
                        padding: '1rem 1.25rem',
                        border: !targetStableId ? '1.5px solid var(--warning)' : '1px solid var(--border)',
                        background: !targetStableId ? 'rgba(234, 179, 8, 0.05)' : 'var(--card-bg)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: !targetStableId ? 'var(--warning)' : 'var(--text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span>المنقية المستهدفة:</span>
                                    <span style={{ color: 'var(--danger)', fontSize: '1rem' }}>* (إلزامي)</span>
                                </span>
                                <select
                                    className="form-control"
                                    style={{
                                        minWidth: 230,
                                        borderColor: !targetStableId ? 'var(--warning)' : undefined,
                                        boxShadow: !targetStableId ? '0 0 0 2px rgba(234, 179, 8, 0.2)' : undefined
                                    }}
                                    value={targetStableId}
                                    onChange={e => setTargetStableId(e.target.value)}
                                >
                                    <option value="">-- يرجى اختيار المنقية أولاً --</option>
                                    {stables.map((s: Stable) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.camel_count || 0} ناقة)</option>
                                    ))}
                                </select>
                                {!targetStableId && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
                                        ⚠️ يجب تحديد المنقية قبل حفظ النياق
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedResults(new Set(liveResults.map((_, i) => i)))}>
                                    تحديد الكل
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                    const valids = new Set(liveResults.reduce((acc: number[], item, i) =>
                                        (item.result?.overall_status === 'green' || item.result?.validation_ok) ? [...acc, i] : acc, []))
                                    setSelectedResults(valids)
                                }}>
                                    الصحيحة فقط
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (!targetStableId) {
                                            toast.error('يرجى اختيار المنقية أولاً لحفظ النياق بها ⚠️')
                                            return
                                        }
                                        saveMutation.mutate()
                                    }}
                                    disabled={totalSelected === 0 || saveMutation.isLoading || !targetStableId}
                                    title={!targetStableId ? 'يجب اختيار المنقية أولاً' : ''}
                                >
                                    {saveMutation.isLoading ? (
                                        <><div className="spinner" style={{width:16,height:16}} /> جاري الحفظ...</>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}>
                                                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                                                <polyline points="17 21 17 13 7 13 7 21"/>
                                            </svg>
                                            حفظ المحدد ({totalSelected}) في النظام
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Real-time Streaming Table */}
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={liveResults.length > 0 && selectedResults.size === liveResults.length}
                                                onChange={() => {
                                                    if (selectedResults.size === liveResults.length) setSelectedResults(new Set())
                                                    else setSelectedResults(new Set(liveResults.map((_, i) => i)))
                                                }}
                                            />
                                        </th>
                                        <th>#</th>
                                        <th>الصورة</th>
                                        <th>الاسم / الرقم</th>
                                        <th>السلالة</th>
                                        <th>النقاط</th>
                                        <th>التباعد</th>
                                        {ATTRIBUTES.map(a => (
                                            <th key={a} style={{ textAlign: 'center' }}>{ATTR_NAMES[a]}</th>
                                        ))}
                                        <th>الحالة</th>
                                        <th style={{ textAlign: 'center' }}>تعديل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liveResults.map((item, i) => {
                                        const r = item.result
                                        const isSelected = selectedResults.has(i)
                                        const st = getStatusStyle(r?.overall_status || (item.status === 'error' ? 'red' : 'yellow'))
                                        const isEditing = editingRow === i

                                        return (
                                            <tr key={i}
                                                style={isSelected ? { background: 'rgba(212, 160, 23, 0.08)' } : undefined}
                                                className={`camel-row ${r?.overall_status === 'green' ? 'valid' : r?.overall_status === 'yellow' ? 'warning' : 'invalid'}`}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const next = new Set(selectedResults)
                                                            next.has(i) ? next.delete(i) : next.add(i)
                                                            setSelectedResults(next)
                                                        }}
                                                    />
                                                </td>
                                                <td>{i + 1}</td>
                                                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {item.filename}
                                                </td>
                                                {/* Editable number field */}
                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            className="form-control"
                                                            style={{ width: 60, padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                                            value={r?.number?.value || ''}
                                                            onChange={e => updateResultField(i, 'number', e.target.value)}
                                                        />
                                                    ) : (
                                                        <strong style={{ color: 'var(--primary)' }}>{r?.name?.value || r?.number?.value || '—'}</strong>
                                                    )}
                                                </td>
                                                <td>{r?.color?.value || '—'}</td>
                                                <td><strong style={{ color: r?.validation_ok ? 'var(--success)' : 'var(--danger)' }}>{r?.points?.value || '—'}</strong></td>
                                                <td><span className={`badge badge-${(parseInt(r?.spacing?.value) || 99) <= 5 ? 'green' : 'yellow'}`}>{r?.spacing?.value ?? '—'}</span></td>
                                                {/* Editable attribute cells */}
                                                {ATTRIBUTES.map(a => {
                                                    const fieldObj = r?.[a]
                                                    const needsReview = fieldNeedsReview(fieldObj)
                                                    return (
                                                        <td key={a} style={{
                                                            textAlign: 'center',
                                                            fontSize: '0.85rem',
                                                            padding: '0.25rem 0.3rem',
                                                            background: needsReview
                                                                ? 'var(--warning-light)'
                                                                : 'transparent',
                                                            border: needsReview
                                                                ? '1px solid var(--warning-medium)'
                                                                : undefined,
                                                            borderRadius: needsReview ? 4 : undefined,
                                                        }}>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    autoFocus={needsReview}
                                                                    style={{
                                                                        width: 66, padding: '0.15rem 0.3rem',
                                                                        fontSize: '0.85rem', textAlign: 'center',
                                                                        border: !fieldObj?.value
                                                                            ? '2px solid var(--danger)'
                                                                            : needsReview
                                                                                ? '2px solid var(--warning)'
                                                                                : '1px solid var(--border)',
                                                                        background: needsReview ? 'var(--warning-light)' : undefined,
                                                                    }}
                                                                    value={fieldObj?.value || ''}
                                                                    onChange={e => updateResultField(i, a, e.target.value)}
                                                                />
                                                            ) : (
                                                                <span style={{
                                                                    fontWeight: needsReview ? 700 : 400,
                                                                    color: !fieldObj?.value
                                                                        ? 'var(--danger)'
                                                                        : needsReview
                                                                            ? 'var(--warning)'
                                                                            : 'var(--text)'
                                                                }}>
                                                                    {fieldObj?.value
                                                                        ? (needsReview ? `⚠ ${fieldObj.value}` : fieldObj.value)
                                                                        : 'ناقص'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                                <td>
                                                    <span style={{ color: st.color, fontWeight: 700, fontSize: '0.82rem' }}>
                                                        {st.label}
                                                        {rowNeedsReview(r) && !isEditing && (
                                                            <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--warning)', marginTop: 2 }}>
                                                                تحتاج مراجعة
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                                {/* Edit toggle button and Retry button */}
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                        {item.status === 'error' && files[i] && (
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                                title="إعادة قراءة هذه الصورة"
                                                                onClick={() => retrySingleFile(i)}
                                                            >
                                                                🔄 إعادة
                                                            </button>
                                                        )}
                                                        {item.status !== 'error' && (
                                                            <button
                                                                className={`btn btn-sm ${isEditing ? 'btn-primary' : rowNeedsReview(r) ? 'btn-warning' : 'btn-secondary'}`}
                                                                style={{
                                                                    padding: '0.2rem 0.5rem',
                                                                    fontSize: '0.75rem',
                                                                    minWidth: 58,
                                                                    fontWeight: rowNeedsReview(r) ? 700 : undefined,
                                                                }}
                                                                onClick={() => setEditingRow(isEditing ? null : i)}
                                                            >
                                                                {isEditing ? 'حفظ' : rowNeedsReview(r) ? '⚠ صحّح' : 'تعديل'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
