import { useEffect, useRef, useState } from 'react'
import styles from './RecordingPanel.module.css'

function formatTime(seconds) {
  const whole = Math.floor(seconds)
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

export default function RecordingPanel({ status, elapsed, recordings, error, supported, onStart, onStop, previewing }) {
  const panelRef = useRef(null)
  const [mediaDurations, setMediaDurations] = useState({})
  const busy = status !== 'idle'
  const statusText = {
    idle: 'Готово к записи',
    starting: 'Включаем запись…',
    recording: 'Идёт запись',
    stopping: 'Сохраняем послезвучие…',
  }[status]

  useEffect(() => {
    if (busy || previewing) panelRef.current.querySelectorAll('audio').forEach((audio) => audio.pause())
  }, [busy, previewing])

  return (
    <section className={styles.panel} aria-labelledby="recording-title" ref={panelRef}>
      <div className={styles.header}>
        <div>
          <h2 id="recording-title" className={styles.title}>Запиши свою мелодию</h2>
          <p className={styles.description}>Только звук пианино — микрофон не нужен.</p>
        </div>
        <output className={styles.timer} aria-label="Длительность записи">{formatTime(elapsed)}</output>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.recordButton} onClick={onStart} disabled={!supported || busy || previewing} aria-keyshortcuts="R">
          <span className={styles.recordDot} aria-hidden="true" />Записать <kbd>R</kbd>
        </button>
        <button type="button" className={styles.button} onClick={onStop} disabled={status !== 'recording' && status !== 'starting'} aria-keyshortcuts="X">Остановить <kbd>X</kbd></button>
        <span className={styles.status} role="status">{statusText}</span>
      </div>
      {!supported && <p className={styles.message}>Запись недоступна в этом браузере. Используй актуальный Chrome, Firefox или Safari.</p>}
      {previewing && <p className={styles.message}>Останови образец мелодии, чтобы записать свою игру.</p>}
      {error && <p className={styles.message} role="alert">{error}</p>}
      {recordings.length > 0 && (
        <>
          <p className={styles.description}>Записи хранятся до перезагрузки страницы. Скачай то, что хочешь оставить.</p>
          <ol className={styles.recordings} aria-label="Готовые записи">
            {recordings.map((recording, index) => (
              <li key={recording.url} className={styles.recording}>
                <div className={styles.recordingHeader}>
                  <span>Запись {recordings.length - index} <span className={styles.details}>· {formatTime(mediaDurations[recording.url] ?? recording.duration)} · {recording.extension.toUpperCase()}</span></span>
                  <a className={styles.download} href={recording.url} download={recording.name}>Скачать<span className={styles.srOnly}> запись {recordings.length - index}</span></a>
                </div>
                <audio
                  controls
                  preload="metadata"
                  src={recording.url}
                  aria-label={`Прослушать запись ${recordings.length - index}`}
                  onLoadedMetadata={(event) => {
                    const audio = event.currentTarget
                    const rememberDuration = () => {
                      setMediaDurations((previous) => (
                        previous[recording.url] ? previous : { ...previous, [recording.url]: audio.duration }
                      ))
                    }
                    if (Number.isFinite(audio.duration)) {
                      rememberDuration()
                      return
                    }
                    // MediaRecorder omits the duration header, so the player sees an endless track
                    // until a seek past the end makes the browser measure the real file length.
                    const revealDuration = () => {
                      audio.removeEventListener('seeked', revealDuration)
                      audio.currentTime = 0
                      rememberDuration()
                    }
                    audio.addEventListener('seeked', revealDuration)
                    audio.currentTime = 1e101
                  }}
                  onPlay={(event) => {
                    if (busy || previewing) event.currentTarget.pause()
                    panelRef.current.querySelectorAll('audio').forEach((audio) => {
                      if (audio !== event.currentTarget) audio.pause()
                    })
                  }}
                />
              </li>
            ))}
          </ol>
          {busy && <p className={styles.description}>Прослушивание доступно после остановки записи.</p>}
        </>
      )}
    </section>
  )
}
