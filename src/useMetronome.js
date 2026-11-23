import { useCallback, useEffect, useRef, useState } from 'react'
import { createMetronome } from './metronome.js'

export function useMetronome(tempo) {
  const [enabled, setEnabled] = useState(false)
  const [beat, setBeat] = useState(null)
  const [error, setError] = useState('')
  const engineRef = useRef(null)
  const enabledRef = useRef(false)
  const tempoRef = useRef(tempo)
  const generationRef = useRef(0)

  const stop = useCallback(() => {
    generationRef.current += 1
    enabledRef.current = false
    engineRef.current?.stop()
    setEnabled(false)
    setBeat(null)
  }, [])

  const toggle = useCallback(async () => {
    if (enabledRef.current) {
      stop()
      return
    }
    enabledRef.current = true
    setEnabled(true)
    setError('')
    const generation = ++generationRef.current
    try {
      engineRef.current ??= createMetronome(setBeat)
      await engineRef.current.start(tempoRef.current)
    } catch {
      if (generation !== generationRef.current) return
      stop()
      setError('Не удалось включить метроном. Попробуй нажать кнопку ещё раз.')
    }
  }, [stop])

  useEffect(() => {
    tempoRef.current = tempo
    engineRef.current?.setTempo(tempo)
  }, [tempo])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) stop()
    }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      generationRef.current += 1
      enabledRef.current = false
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [stop])

  return { enabled, beat, error, toggle, stop }
}
