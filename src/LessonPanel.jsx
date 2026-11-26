import { useEffect, useId, useRef } from 'react'
import { lessonKeys, lessons } from './lessons.js'
import styles from './LessonPanel.module.css'

function beatLabel(beats) {
  return `${String(beats).replace('.', ',')} ${beats === 1 ? 'доля' : 'доли'}`
}

export default function LessonPanel({
  lesson,
  mode,
  position,
  feedback,
  tempo,
  score,
  targetOffset,
  selectLesson,
  startPractice,
  exitPractice,
  togglePreview,
  previewDisabled = false,
}) {
  const id = useId()
  const scoreRef = useRef(null)
  const isPreview = mode === 'preview'
  const isPractice = mode === 'practice'
  const isComplete = mode === 'complete'
  const done = mode === 'idle' ? 0 : position
  const nextNote = lesson.notes[mode === 'idle' ? 0 : position]
  const nextKey = nextNote ? lessonKeys[targetOffset ?? nextNote.offset] : null

  useEffect(() => {
    const score = scoreRef.current
    if (!score) return
    if (mode === 'idle') {
      score.scrollTop = 0
      return
    }
    const chip = score.children.item(Math.min(position, lesson.notes.length - 1))
    if (!chip) return
    const scoreBox = score.getBoundingClientRect()
    const chipBox = chip.getBoundingClientRect()
    const top = chipBox.top - scoreBox.top + score.scrollTop
    const bottom = top + chipBox.height
    if (top < score.scrollTop + 6) score.scrollTop = Math.max(0, top - 6)
    else if (bottom > score.scrollTop + score.clientHeight - 6) {
      score.scrollTop = bottom - score.clientHeight + 6
    }
  }, [lesson.id, lesson.notes.length, mode, position])

  return (
    <aside className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>Разучи мелодию</h2>

      <label className={styles.label} htmlFor={`${id}-select`}>Мелодия</label>
      <select
        id={`${id}-select`}
        className={styles.select}
        value={lesson.id}
        onChange={(event) => selectLesson(event.target.value)}
        aria-describedby={`${id}-description`}
      >
        {lessons.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <p id={`${id}-description`} className={styles.description}>{lesson.description}</p>
      <p className={styles.meta}>{tempo} уд/мин · Октава {lesson.octave} · C{lesson.octave}–C{lesson.octave + 1}</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={previewDisabled && !isPreview}
          aria-describedby={previewDisabled && !isPreview ? `${id}-preview-help` : undefined}
          onClick={togglePreview}
        >
          {isPreview ? 'Остановить образец' : 'Слушать образец'}
        </button>
        <button type="button" className={`${styles.button} ${styles.primaryButton}`} onClick={startPractice}>
          {isPractice || isComplete ? 'Сначала' : 'Начать обучение'}
        </button>
        {(isPractice || isComplete) && (
          <button type="button" className={`${styles.button} ${styles.freeButton}`} onClick={exitPractice}>
            Свободная игра
          </button>
        )}
      </div>
      {previewDisabled && !isPreview && (
        <p id={`${id}-preview-help`} className={styles.recordingHint}>Образец доступен после завершения записи.</p>
      )}

      <div className={styles.progressHeader}>
        <label htmlFor={`${id}-progress`}>{isPreview ? 'Прослушано нот' : 'Сыграно нот'}</label>
        <span>{done} / {lesson.notes.length}</span>
      </div>
      <progress id={`${id}-progress`} className={styles.progress} max={lesson.notes.length} value={done} />

      <div className={styles.nextNote}>
        <span className={styles.label}>
          {isComplete ? 'Мелодия пройдена' : isPreview ? 'Сейчас звучит' : isPractice ? 'Следующая нота' : 'Первая нота'}
        </span>
        {nextKey ? (
          <div className={styles.nextNoteContent}>
            <strong>{nextKey.name}{lesson.octave + (nextNote.offset === 12 ? 1 : 0)}</strong>
            <span className={styles.nextBinding}>клавиша <kbd>{nextKey.binding}</kbd></span>
            <span className={styles.nextDuration}>{beatLabel(nextNote.beats)}</span>
          </div>
        ) : <strong className={styles.completeText}>Все ноты по порядку</strong>}
      </div>

      <p className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
      {(isPractice || isComplete) && (
        <section className={styles.scoreCard} aria-labelledby={`${id}-assessment-title`}>
          <div className={styles.scoreCardHeader}>
            <h3 id={`${id}-assessment-title`} className={styles.scoreTitle}>Баллы</h3>
            <strong className={styles.points}>{score.points} / {score.maxPoints}</strong>
          </div>
          {isComplete && (
            <>
              <p className={styles.rating}>{score.rating}</p>
              <p className={styles.attemptTempo}>Темп попытки: {score.tempo} уд/мин</p>
            </>
          )}
          <dl className={styles.scoreMetrics}>
            <div><dt>Точность нот</dt><dd>{score.pitchPercent}%</dd></div>
            <div>
              <dt>Ритм</dt>
              <dd>{score.rhythmPercent === null ? (
                <><span aria-hidden="true">—</span><span className={styles.visuallyHidden}>После второй верной ноты</span></>
              ) : `${score.rhythmPercent}%`}</dd>
            </div>
            <div><dt>Ошибки</dt><dd>{score.mistakes}</dd></div>
          </dl>
          <p className={styles.scoreHelp}>
            Первая верная нота: +100. Далее: +60 за ноту и до +40 за ритм. Ошибка: −25; можно пробовать дальше.
          </p>
        </section>
      )}
      <h3 id={`${id}-score-title`} className={styles.scoreTitle}>Ноты по порядку</h3>
      <p id={`${id}-rhythm`} className={styles.rhythm}>
        1 доля — один счёт при {isComplete ? score.tempo : tempo} уд/мин. Оцениваем верные ноты и интервалы между нажатиями;
        первая нота задаёт отсчёт. Длительность удержания не оцениваем.
      </p>
      <ol
        ref={scoreRef}
        className={styles.score}
        role="list"
        tabIndex={0}
        aria-labelledby={`${id}-score-title`}
        aria-describedby={`${id}-rhythm`}
      >
        {lesson.notes.map((note, index) => {
          const key = lessonKeys[note.offset]
          const current = (isPractice || isPreview) && index === position
          const completed = index < done
          return (
            <li
              key={`${lesson.id}-${index}`}
              className={`${styles.chip} ${current ? styles.currentChip : ''} ${completed ? styles.completedChip : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              <span className={styles.chipOrder} aria-hidden="true">{index + 1}</span>
              <kbd className={styles.chipBinding}>{key.binding}</kbd>
              <span className={styles.chipName}>{key.name}{lesson.octave + (note.offset === 12 ? 1 : 0)}</span>
              <span className={styles.chipDuration}>{beatLabel(note.beats)}</span>
              {completed && <span className={styles.visuallyHidden}>{isPreview ? 'Прослушана' : 'Сыграна'}</span>}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
