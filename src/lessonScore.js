export function createLessonScore(tempo) {
  return {
    notePoints: 0,
    mistakes: 0,
    timingTotal: 0,
    timingCount: 0,
    lastCorrectAt: null,
    tempo,
  }
}

export function scoreLessonNote(score, { correct, previousBeats, at }) {
  if (!correct) return { ...score, mistakes: score.mistakes + 1 }

  if (score.lastCorrectAt === null) {
    return { ...score, notePoints: score.notePoints + 100, lastCorrectAt: at }
  }

  const interval = previousBeats * 60000 / score.tempo
  const error = Math.abs(at - score.lastCorrectAt - interval)
  const fullCredit = Math.max(70, interval * 0.15)
  const zeroCredit = Math.max(180, interval * 0.5)
  const quality = Math.max(0, Math.min(1, (zeroCredit - error) / (zeroCredit - fullCredit)))

  return {
    ...score,
    notePoints: score.notePoints + 60 + Math.round(40 * quality),
    timingTotal: score.timingTotal + quality,
    timingCount: score.timingCount + 1,
    lastCorrectAt: at,
  }
}

export function summarizeLessonScore(score, correctCount, totalNotes) {
  const points = Math.max(0, score.notePoints - 25 * score.mistakes)
  const maxPoints = totalNotes * 100
  const ratio = points / maxPoints
  const attempts = correctCount + score.mistakes

  return {
    points,
    maxPoints,
    pitchPercent: attempts === 0 ? 0 : Math.round(correctCount / attempts * 100),
    rhythmPercent: score.timingCount === 0 ? null : Math.round(score.timingTotal / score.timingCount * 100),
    mistakes: score.mistakes,
    tempo: score.tempo,
    rating: ratio >= 0.9 ? 'Отлично' : ratio >= 0.75 ? 'Хорошо' : ratio >= 0.5 ? 'Уже получается' : 'Продолжай тренироваться',
  }
}
