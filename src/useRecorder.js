import { useCallback, useEffect, useRef, useState } from 'react'

const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']

function getExtension(type) {
  if (type.includes('webm')) return 'webm'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mp4')) return 'm4a'
  return null
}

function detachRecorder(session) {
  clearTimeout(session.stopTimer)
  if (!session.recorder) return
  session.recorder.ondataavailable = null
  session.recorder.onstop = null
  session.recorder.onerror = null
  if (session.recorder.state !== 'inactive') session.recorder.stop()
}

export function useRecorder(getPiano, stopNotes) {
  const [status, setStatus] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [error, setError] = useState('')
  const sessionRef = useRef(null)
  const urlsRef = useRef(new Set())
  const supported = typeof MediaRecorder !== 'undefined'

  const start = useCallback(async () => {
    if (sessionRef.current) return
    if (typeof MediaRecorder === 'undefined') {
      setError('Этот браузер не поддерживает запись. Попробуй актуальный Chrome, Firefox или Safari.')
      return
    }

    const session = { chunks: [], recorder: null, startedAt: null, stopTimer: null, stopping: false }
    sessionRef.current = session
    setStatus('starting')
    setElapsed(0)
    setError('')

    function fail(message) {
      if (sessionRef.current !== session) return
      sessionRef.current = null
      detachRecorder(session)
      setStatus('idle')
      setError(message)
    }

    try {
      const piano = getPiano()
      await piano.resume()
      if (sessionRef.current !== session) return

      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(piano.recordingStream, mimeType ? { mimeType } : undefined)
      session.recorder = recorder
      session.piano = piano
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) session.chunks.push(event.data)
      }
      recorder.onerror = () => fail('Запись прервалась. Предыдущие записи сохранены ниже; попробуй ещё раз.')
      recorder.onstop = () => {
        if (sessionRef.current !== session) return
        const type = session.chunks[0]?.type || recorder.mimeType
        const extension = getExtension(type)
        const blob = new Blob(session.chunks, { type })
        if (!blob.size || !extension) {
          fail('Не удалось получить аудиофайл. Попробуй записать ещё раз в другом браузере.')
          return
        }

        const duration = (performance.now() - session.startedAt) / 1000
        const url = URL.createObjectURL(blob)
        urlsRef.current.add(url)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        setRecordings((previous) => [{
          url,
          name: `piano-${timestamp}.${extension}`,
          extension,
          duration,
          size: blob.size,
        }, ...previous])
        sessionRef.current = null
        detachRecorder(session)
        // The stopwatch rests once the file is saved; the list keeps the length.
        setElapsed(0)
        setStatus('idle')
      }
      recorder.start(250)
      session.startedAt = performance.now()
      setStatus('recording')
    } catch {
      fail('Не удалось начать запись звука. Попробуй ещё раз или открой другой браузер.')
    }
  }, [getPiano])

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.stopping) return
    if (!session.recorder) {
      sessionRef.current = null
      setStatus('idle')
      return
    }

    session.stopping = true
    setStatus('stopping')
    stopNotes()
    // Capture the release envelope before finalizing the audio file.
    session.stopTimer = setTimeout(() => {
      if (sessionRef.current === session && session.recorder.state !== 'inactive') session.recorder.stop()
    }, (session.piano.getReleaseDuration() + 0.06) * 1000)
  }, [stopNotes])

  useEffect(() => {
    if (status !== 'recording' && status !== 'stopping') return
    const timer = setInterval(() => {
      const session = sessionRef.current
      if (session?.startedAt != null) setElapsed((performance.now() - session.startedAt) / 1000)
    }, 200)
    return () => clearInterval(timer)
  }, [status])

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      if (sessionRef.current) detachRecorder(sessionRef.current)
      sessionRef.current = null
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  return { status, elapsed, recordings, error, supported, start, stop }
}
