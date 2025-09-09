"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { ROBOT_LOGO_PATH, ROBOT_LOGO_VIEWBOX } from "./robot-logo-path"
import { ArrowRight, Plus, X } from "lucide-react"

interface JobResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  content?: string;
  count?: number;
  error?: string;
}

export default function RobotParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const isTouchingRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)
  const [urls, setUrls] = useState<string[]>([""])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [submittedJobs, setSubmittedJobs] = useState<string[]>([])
  const [jobResults, setJobResults] = useState<Record<string, JobResult>>({})
  const [isPolling, setIsPolling] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inputMode, setInputMode] = useState<'individual' | 'bulk'>('individual')
  const [bulkUrls, setBulkUrls] = useState('')
  const [bulkUrlsFocused, setBulkUrlsFocused] = useState(false)

  const cyanColor = "#00DCFF"

  const validUrlCount = urls.filter((url) => url.trim() !== "").length

  const getBulkUrlsCount = () => {
    if (!bulkUrls) return 0;
    return bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && url.match(/^https?:\/\//))
      .length;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let urlsToProcess: string[] = [];
    if (inputMode === 'individual') {
      urlsToProcess = urls.filter(url => url.trim() !== "");
    } else {
      urlsToProcess = bulkUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && url.match(/^https?:\/\//));
    }

    if (urlsToProcess.length === 0) {
      setIsSubmitting(false);
      return;
    }

    try {
      setSubmittedJobs([]);
      setJobResults({});

      if (inputMode === 'individual') {
        const jobs: string[] = [];
        for (const url of urlsToProcess) {
          try {
            const response = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, source: 'frontend', options: { includeMetadata: true } }),
            });
            if (response.ok) {
              const data = await response.json();
              jobs.push(data.jobId);
            }
          } catch {}
        }
        setSubmittedJobs(jobs);
      } else {
        try {
          const response = await fetch('/api/generate/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: urlsToProcess, source: 'frontend', options: { includeMetadata: true } }),
          });
          if (response.ok) {
            const data = await response.json();
            const jobIds = data.jobs.map((job: { jobId: string }) => job.jobId);
            setSubmittedJobs(jobIds);
          }
        } catch {}
      }

      setIsPolling(true);
      if (inputMode === 'individual') setUrls(['']); else setBulkUrls('');
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls]
    newUrls[index] = value
    setUrls(newUrls)
  }

  const addUrlField = () => {
    setUrls([...urls, ""]) 
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[type="url"]')
      const lastInput = inputs[inputs.length - 1] as HTMLInputElement
      if (lastInput) lastInput.focus()
    }, 10)
  }

  const removeUrlField = (index: number) => {
    if (urls.length <= 1) return
    const newUrls = urls.filter((_, i) => i !== index)
    setUrls(newUrls)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = Math.min(500, window.innerHeight * 0.6)
      setIsMobile(window.innerWidth < 768)
    }

    updateCanvasSize()

    let particles: { x: number; y: number; baseX: number; baseY: number; size: number; color: string; scatteredColor: string; life: number }[] = []
    let textImageData: ImageData | null = null

    function createTextImage() {
      if (!ctx || !canvas) return 0
      ctx.fillStyle = "white"
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const logoHeight = isMobile ? 100 : 160
      const aspectRatio = ROBOT_LOGO_VIEWBOX.width / ROBOT_LOGO_VIEWBOX.height
      const logoWidth = logoHeight * aspectRatio
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      ctx.translate(centerX - logoWidth / 2, centerY - logoHeight / 2)
      const logoScale = logoHeight / ROBOT_LOGO_VIEWBOX.height
      ctx.scale(logoScale, logoScale)
      const path = new Path2D(ROBOT_LOGO_PATH)
      ctx.fill(path)
      ctx.restore()
      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return logoScale
    }

    function createParticle(scale: number) {
      if (!ctx || !canvas || !textImageData) return null
      const data = textImageData.data
      const safetyMargin = 10
      const effectiveWidth = canvas.width - 2 * safetyMargin
      const effectiveHeight = canvas.height - 2 * safetyMargin
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(safetyMargin + Math.random() * effectiveWidth)
        const y = Math.floor(safetyMargin + Math.random() * effectiveHeight)
        if (data[(y * canvas.width + x) * 4 + 3] > 128) {
          return { x, y, baseX: x, baseY: y, size: Math.random() * 1 + 0.5, color: "white", scatteredColor: cyanColor, life: Math.random() * 100 + 50 }
        }
      }
      return null
    }

    function createInitialParticles(scale: number) {
      const baseParticleCount = 5000
      if (!canvas) return
      const canvasArea = canvas.width * canvas.height
      const referenceArea = 1920 * 1080
      const scaleFactor = Math.sqrt(canvasArea / referenceArea)
      const particleCount = Math.floor(baseParticleCount * scaleFactor)
      for (let i = 0; i < particleCount; i++) {
        const p = createParticle(scale)
        if (p) particles.push(p)
      }
    }

    let animationFrameId: number

    function animate(scale: number) {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const { x: mouseX, y: mouseY } = mousePositionRef.current
      const maxDistance = 240
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < maxDistance && (isTouchingRef.current || !("ontouchstart" in window))) {
          const force = (maxDistance - distance) / maxDistance
          const angle = Math.atan2(dy, dx)
          const moveX = Math.cos(angle) * force * 60
          const moveY = Math.sin(angle) * force * 60
          p.x = p.baseX - moveX
          p.y = p.baseY - moveY
          ctx.fillStyle = p.scatteredColor
        } else {
          p.x += (p.baseX - p.x) * 0.1
          p.y += (p.baseY - p.y) * 0.1
          ctx.fillStyle = "white"
        }
        ctx.fillRect(p.x, p.y, p.size, p.size)
        p.life--
        if (p.life <= 0) {
          const np = createParticle(scale)
          if (np) particles[i] = np; else { particles.splice(i, 1); i-- }
        }
      }
      const baseParticleCount = 5000
      if (!canvas) return
      const canvasArea = canvas.width * canvas.height
      const referenceArea = 1920 * 1080
      const scaleFactor = Math.sqrt(canvasArea / referenceArea)
      const targetParticleCount = Math.floor(baseParticleCount * scaleFactor)
      while (particles.length < targetParticleCount) {
        const np = createParticle(scale)
        if (np) particles.push(np)
      }
      animationFrameId = requestAnimationFrame(() => animate(scale))
    }

    const scale = createTextImage()
    createInitialParticles(scale)
    animate(scale)

    const handleResize = () => {
      updateCanvasSize()
      const newScale = createTextImage()
      particles = []
      createInitialParticles(newScale)
    }

    const handleMove = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect()
      const canvasX = x - rect.left
      const canvasY = y - rect.top
      if (canvasX >= 0 && canvasX <= canvas.width && canvasY >= 0 && canvasY <= canvas.height) {
        mousePositionRef.current = { x: canvasX, y: canvasY }
      } else {
        mousePositionRef.current = { x: 0, y: 0 }
      }
    }

    const handleMouseMove = (e: MouseEvent) => { handleMove(e.clientX, e.clientY) }
    const handleTouchMove = (e: TouchEvent) => { if (e.touches.length > 0) { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY) } }
    const handleTouchStart = () => { isTouchingRef.current = true }
    const handleTouchEnd = () => { isTouchingRef.current = false; mousePositionRef.current = { x: 0, y: 0 } }
    const handleMouseLeave = () => { if (!("ontouchstart" in window)) { mousePositionRef.current = { x: 0, y: 0 } } }

    window.addEventListener("resize", handleResize)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("mouseleave", handleMouseLeave)
    canvas.addEventListener("touchstart", handleTouchStart)
    canvas.addEventListener("touchend", handleTouchEnd)

    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchend", handleTouchEnd)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isMobile])

  useEffect(() => {
    if (submittedJobs.length === 0 || !isPolling) return;
    let activePolling = true;
    const pollInterval = 10000;
    const maxRetries = 20;
    let retryCount = 0;
    const pollJobs = async () => {
      if (!activePolling || retryCount >= maxRetries) { setIsPolling(false); return; }
      try {
        let allCompleted = true;
        for (const jobId of submittedJobs) {
          if (jobResults[jobId]?.status === 'completed' || jobResults[jobId]?.status === 'failed') continue;
          try {
            const response = await fetch(`/api/status/${jobId}`);
            const jobData = await response.json();
            setJobResults(prev => ({ ...prev, [jobId]: jobData }));
            if (jobData.status !== 'completed' && jobData.status !== 'failed') allCompleted = false;
          } catch { allCompleted = false; }
        }
        if (allCompleted) setIsPolling(false); else { retryCount++; if (activePolling) setTimeout(pollJobs, pollInterval); }
      } catch { retryCount++; if (activePolling && retryCount < maxRetries) setTimeout(pollJobs, pollInterval); else setIsPolling(false); }
    };
    pollJobs();
    return () => { activePolling = false };
  }, [submittedJobs, isPolling])

  return (
    <div className="min-h-screen bg-black overflow-x-hidden flex flex-col items-center">
      <div className="relative w-full h-[500px] md:h-[60vh] overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" aria-label="Interactive particle effect with Robot logo" />
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <h2 className="font-mono text-gray-300 text-xl font-bold">
            scrape the web
          </h2>
        </div>
      </div>

      <div ref={contentRef} className="w-full max-w-xl px-4 py-8">
        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div className="flex mb-4 bg-white/10 rounded-lg p-1">
            <button type="button" onClick={() => setInputMode('individual')} className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${inputMode === 'individual' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/5'}`}>
              Individual URLs
            </button>
            <button type="button" onClick={() => setInputMode('bulk')} className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${inputMode === 'bulk' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/5'}`}>
              Bulk URLs
            </button>
          </div>

          {inputMode === 'individual' && urls.map((url, index) => (
            <div key={index} className="relative">
              <div className={`relative ${focusedIndex === index ? "ring-2 ring-[#00DCFF] rounded-lg" : ""}`}>
                <input type="url" placeholder="https://example.com" value={url} onChange={(e) => handleUrlChange(index, e.target.value)} onFocus={() => setFocusedIndex(index)} onBlur={() => setFocusedIndex(null)} className={`w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-md border ${focusedIndex === index ? "border-[#00DCFF]" : "border-white/20"} text-white placeholder-gray-400 outline-none pr-12`} style={{ boxShadow: focusedIndex === index ? `0 0 0 1px ${cyanColor}, 0 0 8px rgba(0, 220, 255, 0.3)` : "none", transition: "all 0.2s ease" }} required={index === 0} />
                {urls.length > 1 && (
                  <button type="button" onClick={() => removeUrlField(index)} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/90 p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Remove URL field">
                    <X size={16} />
                  </button>
                )}
                {urls.length === 1 && (
                  <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-[#00DCFF] p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Submit URL" disabled={isSubmitting}>
                    <ArrowRight size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {inputMode === 'bulk' && (
            <div className="relative">
              <textarea placeholder={`Enter multiple URLs (one per line)\nhttps://example1.com\nhttps://example2.com\nhttps://example3.com`} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} rows={6} className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 outline-none" style={{ boxShadow: bulkUrlsFocused ? `0 0 0 1px ${cyanColor}, 0 0 8px rgba(0, 220, 255, 0.3)` : "none", transition: "all 0.2s ease" }} onFocus={() => setBulkUrlsFocused(true)} onBlur={() => setBulkUrlsFocused(false)} />
              <div className="mt-2 text-xs text-white/50">
                <span className="text-[#00DCFF]">{getBulkUrlsCount()}</span> valid URLs detected
              </div>
            </div>
          )}

          {inputMode === 'individual' && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={addUrlField} className="flex items-center gap-2 text-white/70 hover:text-[#00DCFF] py-2 px-3 rounded-md hover:bg-white/5 transition-colors text-sm" disabled={isSubmitting}>
                <Plus size={16} />
                <span>Add another website</span>
              </button>
            </div>
          )}

          <div className="pt-4">
            <button type="submit" className="w-full flex items-center justify-center gap-2 bg-[#00DCFF]/10 hover:bg-[#00DCFF]/20 border border-[#00DCFF]/30 text-white py-3 px-6 rounded-lg transition-colors" disabled={isSubmitting || (inputMode === 'bulk' && getBulkUrlsCount() === 0)}>
              <ArrowRight size={18} />
              <span>
                {isSubmitting ? "Processing..." : inputMode === 'individual' ? `Process ${validUrlCount} ${validUrlCount === 1 ? "website" : "websites"}` : `Process ${getBulkUrlsCount()} websites`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {submittedJobs.length > 0 && (
        <div className="mt-8 space-y-4 w-full max-w-xl px-4 pb-16">
          <h3 className="text-lg font-medium text-white">Processing Status</h3>
          {submittedJobs.map(jobId => {
            const job = jobResults[jobId] || { status: 'pending' }
            return (
              <div key={jobId} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex justify-between">
                  <div className="font-mono text-sm text-gray-400">Job #{jobId}</div>
                  <div className={`text-sm ${job.status === 'completed' ? 'text-green-400' : job.status === 'processing' ? 'text-blue-400' : job.status === 'failed' ? 'text-red-400' : 'text-gray-400'}`}>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</div>
                </div>
                {job.url && (<div className="mt-2 text-sm text-white/70 truncate">URL: {job.url}</div>)}
                {job.status === 'completed' && job.content && (
                  <div className="mt-4">
                    <div className="text-sm text-white/70 mb-1">Processed {job.count || 'multiple'} pages for {job.url} LLMs.txt</div>
                    <div className="p-3 bg-black/30 rounded border border-white/10 font-mono text-xs text-white/80 max-h-32 overflow-y-auto">
                      <pre>{job.content}</pre>
                    </div>
                  </div>
                )}
                {job.status === 'failed' && job.error && (<div className="mt-2 text-sm text-red-400">Error: {job.error}</div>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


