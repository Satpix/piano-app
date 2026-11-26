import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { lessonKeys, lessons } from './lessons.js'
import { createLessonScore, scoreLessonNote, summarizeLessonScore } from './lessonScore.js'

const idleFeedback = 'Сначала послушай образец или сразу начни обучение.'
const audioFeedback = 'Не удалось включить звук образца. Попробуй нажать «Слушать образец» ещё раз.'
const stopFeedback = 'Не удалось остановить звук образца. Попробуй остановить его ещё раз.'
const initialState = { lesson: lessons[0], mode: 'idle', position: 0, feedback: idleFeedback, score: null }

function notePrompt(lesson, position) {
  const { offset } = lesson.notes[position]
  const { name, binding } = lessonKeys[offset]
  const octave = lesson.octave + (offset === 12 ? 1 : 0)
  return `Нота ${position + 1} из ${lesson.notes.length}: ${name}${octave}, клавиша ${binding}.`
}

function stopVoice(voice) {
  try {
    voice.piano.stop(voice.source)
    return true
  } catch {
    return false
  }
}

export function useLesson({ getPiano, prepareLesson, tempo, onTempoChange }) {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(initialState)
  const timersRef = useRef(new Set())
  const voicesRef = useRef(new Set())
  const generationRef = useRef(0)
  const sourceId = useId()

  const updateState = useCallback((nextState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const clearPreview = useCallback(() => {
    generationRef.current += 1
    for (const timer of timersRef.current) clearTimeout(timer)
    timersRef.current.clear()
    let stopped = true
    for (const voice of voicesRef.current) {
      if (stopVoice(voice)) voicesRef.current.delete(voice)
      else stopped = false
    }
    return stopped
  }, [])

  const cancelPreview = useCallback(() => {
    const current = stateRef.current
    if (current.mode !== 'preview') return
    const stopped = clearPreview()
    updateState({
      ...current,
      mode: 'idle',
      position: 0,
      score: null,
      feedback: stopped ? 'Образец остановлен. Можешь играть самостоятельно или начать обучение.' : stopFeedback,
    })
  }, [clearPreview, updateState])

  const selectLesson = useCallback((id) => {
    const lesson = lessons.find((item) => item.id === id)
    if (!lesson) return
    const stopped = clearPreview()
    onTempoChange(lesson.bpm)
    updateState({ lesson, mode: 'idle', position: 0, score: null, feedback: stopped ? idleFeedback : stopFeedback })
  }, [clearPreview, onTempoChange, updateState])

  const startPractice = useCallback(() => {
    const { lesson } = stateRef.current
    const stopped = clearPreview()
    if (!stopped) {
      updateState({ lesson, mode: 'idle', position: 0, score: null, feedback: stopFeedback })
      return
    }
    try {
      prepareLesson(lesson.octave)
      updateState({ lesson, mode: 'practice', position: 0, score: createLessonScore(tempo), feedback: notePrompt(lesson, 0) })
    } catch {
      updateState({ lesson, mode: 'idle', position: 0, score: null, feedback: 'Не удалось подготовить пианино. Попробуй начать обучение ещё раз.' })
    }
  }, [clearPreview, prepareLesson, tempo, updateState])

  const exitPractice = useCallback(() => {
    const stopped = clearPreview()
    updateState({
      ...stateRef.current,
      mode: 'idle',
      position: 0,
      score: null,
      feedback: stopped ? 'Свободная игра. Возвращайся к мелодии, когда захочешь.' : stopFeedback,
    })
  }, [clearPreview, updateState])

  const acceptNote = useCallback((midi, at = performance.now()) => {
    const current = stateRef.current
    if (current.mode === 'preview') {
      cancelPreview()
      return
    }
    if (current.mode !== 'practice') return
    const { lesson, position } = current
    const expectedMidi = 12 * (lesson.octave + 1) + lesson.notes[position].offset
    const correct = midi === expectedMidi
    const score = scoreLessonNote(current.score, {
      correct,
      previousBeats: lesson.notes[position - 1]?.beats,
      at,
    })
    if (!correct) {
      updateState({ ...current, score, feedback: `Пока не та нота. ${notePrompt(lesson, position)}` })
      return
    }
    const nextPosition = position + 1
    const complete = nextPosition === lesson.notes.length
    const result = complete ? summarizeLessonScore(score, nextPosition, lesson.notes.length) : null
    updateState({
      lesson,
      mode: complete ? 'complete' : 'practice',
      position: nextPosition,
      score,
      feedback: complete
        ? `Мелодия сыграна! ${result.rating}: ${result.points} из ${result.maxPoints} баллов при ${result.tempo} уд/мин. Можешь повторить или выбрать другую.`
        : notePrompt(lesson, nextPosition),
    })
  }, [cancelPreview, updateState])

  const togglePreview = useCallback(() => {
    if (stateRef.current.mode === 'preview') {
      cancelPreview()
      return
    }
    const { lesson } = stateRef.current
    if (!clearPreview()) {
      updateState({ lesson, mode: 'idle', position: 0, score: null, feedback: stopFeedback })
      return
    }
    const generation = generationRef.current
    let nextDeadline = null

    function failPreview() {
      if (generation !== generationRef.current) return
      clearPreview()
      updateState({ lesson, mode: 'idle', position: 0, score: null, feedback: audioFeedback })
    }

    function schedule(callback, delay) {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        if (generation === generationRef.current) callback()
      }, Math.max(0, delay))
      timersRef.current.add(timer)
    }

    try {
      prepareLesson(lesson.octave)
      const piano = getPiano()
      updateState({ lesson, mode: 'preview', position: 0, score: null, feedback: 'Включаем образец…' })

      async function playStep(position) {
        if (generation !== generationRef.current) return
        const note = lesson.notes[position]
        const voice = { piano, source: `lesson:${sourceId}:${generation}:${position}` }
        voicesRef.current.add(voice)
        try {
          await piano.play(voice.source, 12 * (lesson.octave + 1) + note.offset)
          if (generation !== generationRef.current) {
            stopVoice(voice)
            voicesRef.current.delete(voice)
            return
          }
          updateState({ lesson, mode: 'preview', position, score: null, feedback: `Слушай образец. ${notePrompt(lesson, position)}` })
          const duration = note.beats * 60000 / tempo
          nextDeadline = (nextDeadline ?? performance.now()) + duration
          schedule(() => {
            if (!stopVoice(voice)) {
              failPreview()
              return
            }
            voicesRef.current.delete(voice)
          }, nextDeadline - duration * 0.2 - performance.now())
          schedule(() => {
            if (position + 1 < lesson.notes.length) {
              void playStep(position + 1)
            } else {
              const stopped = clearPreview()
              updateState({
                lesson,
                mode: 'idle',
                position: 0,
                score: null,
                feedback: stopped ? 'Образец завершён. Теперь попробуй сыграть мелодию сам.' : stopFeedback,
              })
            }
          }, nextDeadline - performance.now())
        } catch {
          stopVoice(voice)
          voicesRef.current.delete(voice)
          failPreview()
        }
      }

      void playStep(0)
    } catch {
      failPreview()
    }
  }, [cancelPreview, clearPreview, getPiano, prepareLesson, sourceId, tempo, updateState])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) cancelPreview()
    }
    window.addEventListener('blur', cancelPreview)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', cancelPreview)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearPreview()
    }
  }, [cancelPreview, clearPreview])

  const targetOffset = state.mode === 'practice' || state.mode === 'preview'
    ? state.lesson.notes[state.position]?.offset ?? null
    : null

  return {
    ...state,
    tempo,
    score: state.score ? summarizeLessonScore(state.score, state.position, state.lesson.notes.length) : null,
    targetOffset,
    selectLesson,
    startPractice,
    exitPractice,
    togglePreview,
    acceptNote,
    cancelPreview,
  }
}
