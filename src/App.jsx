import { useCallback, useEffect, useRef, useState } from 'react'
import { createPiano } from './audio.js'
import { useRecorder } from './useRecorder.js'
import { useLesson } from './useLesson.js'
import { useMetronome } from './useMetronome.js'
import { lessons } from './lessons.js'
import MetronomePanel from './MetronomePanel.jsx'
import RecordingPanel from './RecordingPanel.jsx'
import LessonPanel from './LessonPanel.jsx'
import styles from './App.module.css'

const notes = [
  { offset: 0, name: 'C', code: 'KeyA', binding: 'A' },
  { offset: 1, name: 'C♯', code: 'KeyW', binding: 'W', black: true, position: 1 },
  { offset: 2, name: 'D', code: 'KeyS', binding: 'S' },
  { offset: 3, name: 'D♯', code: 'KeyE', binding: 'E', black: true, position: 2 },
  { offset: 4, name: 'E', code: 'KeyD', binding: 'D' },
  { offset: 5, name: 'F', code: 'KeyF', binding: 'F' },
  { offset: 6, name: 'F♯', code: 'KeyT', binding: 'T', black: true, position: 4 },
  { offset: 7, name: 'G', code: 'KeyG', binding: 'G' },
  { offset: 8, name: 'G♯', code: 'KeyY', binding: 'Y', black: true, position: 5 },
  { offset: 9, name: 'A', code: 'KeyH', binding: 'H' },
  { offset: 10, name: 'A♯', code: 'KeyU', binding: 'U', black: true, position: 6 },
  { offset: 11, name: 'B', code: 'KeyJ', binding: 'J' },
  { offset: 12, name: 'C', code: 'KeyK', binding: 'K' },
]

const themes = [
  { id: 'porcelain', name: 'Фарфор', colors: ['#f3f2f7', '#ffffff', '#252238', '#6d687f', '#7962db', '#ddd9e8'] },
  { id: 'midnight', name: 'Полночь', colors: ['#111827', '#1c2638', '#f2f6ff', '#a4b2c9', '#6ed8e7', '#354258'] },
  { id: 'forest', name: 'Лес', colors: ['#14241d', '#20372b', '#edf6ee', '#a8bfb0', '#91d6a3', '#3b5545'] },
  { id: 'sand', name: 'Песок', colors: ['#f5efe4', '#fffaf2', '#3f3024', '#847260', '#b86827', '#e2d3bd'] },
  { id: 'rose', name: 'Роза', colors: ['#fcf0f4', '#fffafd', '#4a2636', '#916777', '#b94070', '#edcfdb'] },
  { id: 'lavender', name: 'Лаванда', colors: ['#eeebfa', '#f9f7ff', '#352950', '#7c6b95', '#7751bd', '#d8ceed'] },
  { id: 'ocean', name: 'Океан', colors: ['#0d2637', '#17394c', '#e9f7ff', '#9bbbcf', '#69c6f1', '#31566e'] },
  { id: 'peach', name: 'Персик', colors: ['#fff0e8', '#fffaf5', '#4a3028', '#946f62', '#c15b40', '#f0d2c1'] },
  { id: 'graphite', name: 'Графит', colors: ['#1c1c20', '#2a2a30', '#f6f4ed', '#b5b3bd', '#e6c76b', '#45454e'] },
  { id: 'mint', name: 'Мята', colors: ['#eaf5f0', '#f8fffb', '#203e33', '#668879', '#258363', '#c8e3d5'] },
]

const colorVariables = ['--canvas', '--surface', '--ink', '--muted', '--accent', '--line']
const minOctave = 2
const maxOctave = 6

function getSavedTheme() {
  try {
    const saved = localStorage.getItem('piano-theme')
    return themes.find((theme) => theme.id === saved) ?? themes[0]
  } catch {
    return themes[0]
  }
}

export default function App() {
  const [theme, setTheme] = useState(getSavedTheme)
  const [octave, setOctave] = useState(4)
  const [tempo, setTempo] = useState(lessons[0].bpm)
  const [volume, setVolume] = useState(0.6)
  const [longRelease, setLongRelease] = useState(true)
  const [activeNotes, setActiveNotes] = useState(new Set())
  const [error, setError] = useState('')
  const pianoRef = useRef(null)
  const sourcesRef = useRef(new Map())
  const volumeRef = useRef(volume)
  const longReleaseRef = useRef(longRelease)
  const lessonRef = useRef(null)
  const recordingStatusRef = useRef('idle')

  const getPiano = useCallback(() => {
    pianoRef.current ??= createPiano(volumeRef.current, longReleaseRef.current)
    return pianoRef.current
  }, [])

  const stopNote = useCallback((source) => {
    if (!sourcesRef.current.has(source)) return
    pianoRef.current?.stop(source)
    sourcesRef.current.delete(source)
    setActiveNotes(new Set(sourcesRef.current.values()))
  }, [])

  const stopAll = useCallback(() => {
    pianoRef.current?.stopAll()
    sourcesRef.current.clear()
    setActiveNotes(new Set())
  }, [])

  const prepareLesson = useCallback((lessonOctave) => {
    stopAll()
    setOctave(lessonOctave)
  }, [stopAll])

  const recorder = useRecorder(getPiano, stopAll)
  const { start: beginRecording, stop: stopRecording } = recorder
  const lesson = useLesson({ getPiano, prepareLesson, tempo, onTempoChange: setTempo })
  const metronome = useMetronome(tempo)
  const { stop: stopMetronome } = metronome
  const octaveLocked = lesson.mode === 'practice' || lesson.mode === 'preview'

  useEffect(() => {
    if (lesson.mode === 'preview') stopMetronome()
  }, [lesson.mode, stopMetronome])

  useEffect(() => {
    lessonRef.current = lesson
    recordingStatusRef.current = recorder.status
  }, [lesson, recorder.status])

  const startRecording = useCallback(() => {
    if (lessonRef.current?.mode !== 'preview') void beginRecording()
  }, [beginRecording])

  const startNote = useCallback((source, offset, currentOctave) => {
    if (sourcesRef.current.has(source) || recordingStatusRef.current === 'stopping') return
    lessonRef.current?.cancelPreview()

    try {
      const midi = 12 * (currentOctave + 1) + offset
      const ready = getPiano().play(source, midi)
      lessonRef.current?.acceptNote(midi)
      sourcesRef.current.set(source, offset)
      setActiveNotes(new Set(sourcesRef.current.values()))
      setError('')
      ready.catch(() => {
        stopNote(source)
        setError('Не удалось включить звук. Попробуй нажать на клавишу ещё раз.')
      })
    } catch {
      setError('Не удалось включить звук. Проверь, поддерживает ли браузер Web Audio.')
    }
  }, [getPiano, stopNote])

  const changeOctave = useCallback((nextOctave) => {
    if (lessonRef.current?.mode === 'practice' || lessonRef.current?.mode === 'preview') return
    stopAll()
    setOctave(Math.min(maxOctave, Math.max(minOctave, nextOctave)))
  }, [stopAll])

  useEffect(() => {
    volumeRef.current = volume
    pianoRef.current?.setVolume(volume)
  }, [volume])

  useEffect(() => {
    longReleaseRef.current = longRelease
    pianoRef.current?.setLongRelease(longRelease)
  }, [longRelease])

  useEffect(() => {
    try {
      localStorage.setItem('piano-theme', theme.id)
    } catch {
      return
    }
  }, [theme])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable || target.closest('input:not([type="checkbox"]), select, textarea')
      )) return

      if (event.code === 'KeyR' || event.code === 'KeyX') {
        event.preventDefault()
        if (event.code === 'KeyR') startRecording()
        else stopRecording()
        return
      }

      if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
        event.preventDefault()
        changeOctave(octave + (event.code === 'BracketRight' ? 1 : -1))
        return
      }

      const note = notes.find((note) => note.code === event.code)
      if (!note) return
      event.preventDefault()
      startNote(`keyboard:${event.code}`, note.offset, octave)
    }

    function handleKeyUp(event) {
      stopNote(`keyboard:${event.code}`)
    }

    function handleVisibilityChange() {
      if (document.hidden) stopAll()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', stopAll)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', stopAll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [octave, startNote, stopNote, stopAll, changeOctave, startRecording, stopRecording])

  useEffect(() => () => {
    pianoRef.current?.dispose()
    pianoRef.current = null
  }, [])

  function renderKey(note) {
    const label = `${note.name}${octave + (note.offset === 12 ? 1 : 0)}`
    return (
      <button
        key={note.offset}
        type="button"
        className={`${styles.key} ${note.black ? styles.keyBlack : styles.keyWhite} ${activeNotes.has(note.offset) ? styles.keyActive : ''} ${lesson.targetOffset === note.offset && octave === lesson.lesson.octave ? styles.keyExpected : ''}`}
        style={note.black ? { left: `calc(${note.position * 12.5}% - 3.75%)` } : undefined}
        aria-label={`Нота ${label}, клавиша ${note.binding}`}
        aria-pressed={activeNotes.has(note.offset)}
        data-note={note.offset}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          startNote(`pointer:${event.pointerId}`, note.offset, octave)
        }}
        onPointerUp={(event) => stopNote(`pointer:${event.pointerId}`)}
        onPointerCancel={(event) => stopNote(`pointer:${event.pointerId}`)}
        onLostPointerCapture={(event) => stopNote(`pointer:${event.pointerId}`)}
        onKeyDown={(event) => {
          if (event.code !== 'Space' && event.code !== 'Enter') return
          event.preventDefault()
          if (!event.repeat) startNote(`button:${note.offset}:${event.code}`, note.offset, octave)
        }}
        onKeyUp={(event) => {
          if (event.code !== 'Space' && event.code !== 'Enter') return
          event.preventDefault()
          stopNote(`button:${note.offset}:${event.code}`)
        }}
        onBlur={() => {
          stopNote(`button:${note.offset}:Space`)
          stopNote(`button:${note.offset}:Enter`)
        }}
      >
        <span className={styles.noteName}>{label}</span>
        <span className={styles.keyBinding}>{note.binding}</span>
      </button>
    )
  }

  return (
    <main
      className={styles.app}
      data-theme={theme.id}
      style={Object.fromEntries(colorVariables.map((variable, index) => [variable, theme.colors[index]]))}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>ТВОЯ МУЗЫКАЛЬНАЯ ПАУЗА</p>
            <h1 className={styles.title}>Пианино<span className={styles.titleDot}>.</span></h1>
            <p className={styles.description}>Одна клавиатура. Много настроений.</p>
          </div>
          <span className={styles.badge}><span className={styles.statusDot} />Синтезированный звук</span>
        </header>

        <div className={styles.workspace}>
          <div className={styles.playArea}>
            <section className={styles.instrument} aria-label="Пианино">
              <div className={styles.toolbar}>
                <div className={styles.octaveControl}>
                  <span className={styles.controlLabel}>Октава</span>
                  <div className={styles.stepper}>
                    <button type="button" className={styles.stepButton} disabled={octave === minOctave || octaveLocked} aria-label="Октава ниже" onClick={() => changeOctave(octave - 1)}>−</button>
                    <output className={styles.octaveValue} aria-label="Текущая октава">{octave}</output>
                    <button type="button" className={styles.stepButton} disabled={octave === maxOctave || octaveLocked} aria-label="Октава выше" onClick={() => changeOctave(octave + 1)}>+</button>
                  </div>
                </div>
                <div className={styles.soundControls}>
                  <label className={styles.volumeControl}>
                    <span className={styles.controlLabel}>Громкость</span>
                    <input className={styles.volumeSlider} type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
                    <span className={styles.volumeValue}>{Math.round(volume * 100)}%</span>
                  </label>
                  <label className={styles.releaseControl} title="Долгое послезвучие: нота затухает несколько секунд после отпускания">
                    <input className={styles.releaseCheckbox} type="checkbox" checked={longRelease} onChange={(event) => setLongRelease(event.target.checked)} />
                    <span>Послезвучие</span>
                  </label>
                </div>
              </div>

              <div className={styles.keyboard}>
                <div className={styles.whiteKeys}>{notes.filter((note) => !note.black).map(renderKey)}</div>
                {notes.filter((note) => note.black).map(renderKey)}
              </div>

              <div className={styles.instrumentFooter}>
                <p className={styles.hint}>Играй клавишами <kbd>A</kbd>…<kbd>K</kbd> или нажимай на пианино</p>
                <span className={styles.rangeLabel}>C{octave} — C{octave + 1}</span>
              </div>
              {octaveLocked && <p className={styles.hint}>Октава {lesson.lesson.octave} задана мелодией. Для смены вернись к свободной игре.</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
            </section>
            <MetronomePanel
              {...metronome}
              tempo={tempo}
              onTempoChange={setTempo}
              onToggle={metronome.toggle}
              tempoLocked={octaveLocked}
              previewing={lesson.mode === 'preview'}
            />
            <RecordingPanel {...recorder} onStart={startRecording} onStop={recorder.stop} previewing={lesson.mode === 'preview'} />
          </div>
          <LessonPanel {...lesson} previewDisabled={recorder.status !== 'idle'} />
        </div>

        <section className={styles.themes} aria-labelledby="themes-title">
          <div className={styles.sectionHeader}>
            <h2 id="themes-title" className={styles.sectionTitle}>Выбери настроение</h2>
            <span className={styles.sectionMeta}>10 палитр</span>
          </div>
          <div className={styles.themeGrid}>
            {themes.map((option) => (
              <button key={option.id} type="button" className={`${styles.themeButton} ${theme.id === option.id ? styles.themeSelected : ''}`} aria-pressed={theme.id === option.id} onClick={() => setTheme(option)}>
                <span className={styles.swatches} aria-hidden="true">
                  <span style={{ background: option.colors[0] }} />
                  <span style={{ background: option.colors[2] }} />
                  <span style={{ background: option.colors[4] }} />
                </span>
                <span className={styles.themeName}>{option.name}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>R — запись · X — остановить и подготовить скачивание</span>
          <span>[ и ] — смена октавы</span>
        </footer>
      </div>
    </main>
  )
}
