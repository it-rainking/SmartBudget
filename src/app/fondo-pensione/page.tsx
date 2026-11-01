'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useTheme } from '@/components/ThemeProvider'

// Lo strumento "Confronto fondo pensione" è un HTML autonomo (dati COVIP, d3 e
// logica inclusi) servito da public/tools/fondo-pensione/. Stesso dominio
// dell'app: la pagina può quindi leggere il documento dell'iframe per
// allinearne il tema e adattarne l'altezza al contenuto, così lo scroll resta
// quello della pagina e non compare una seconda barra dentro il riquadro.
const TOOL_SRC = '/tools/fondo-pensione/index.html'
const MIN_HEIGHT = 600

export default function FondoPensionePage() {
  const { theme } = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(MIN_HEIGHT)

  const applyTheme = useCallback(() => {
    const root = iframeRef.current?.contentDocument?.documentElement
    if (!root) return
    // 'system' lascia decidere al prefers-color-scheme dello strumento
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(applyTheme, [applyTheme])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    let observer: ResizeObserver | null = null

    const onLoad = () => {
      applyTheme()
      const body = iframe.contentDocument?.body
      if (!body) return
      observer?.disconnect()
      observer = new ResizeObserver(() => {
        setHeight(Math.max(MIN_HEIGHT, Math.ceil(body.scrollHeight)))
      })
      observer.observe(body)
    }

    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') onLoad()
    return () => {
      iframe.removeEventListener('load', onLoad)
      observer?.disconnect()
    }
  }, [applyTheme])

  return (
    <DashboardLayout>
      <div className="-m-4 sm:-m-6 lg:-m-8">
        <iframe
          ref={iframeRef}
          src={TOOL_SRC}
          title="Confronto fondo pensione"
          className="block w-full border-0"
          style={{ height }}
        />
      </div>
    </DashboardLayout>
  )
}
