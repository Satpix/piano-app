import styles from './MetronomePanel.module.css'

export default function MetronomePanel({ tempo, onTempoChange, enabled, beat, error, onToggle, tempoLocked, previewing }) {
  return (
    <section className={styles.panel} aria-labelledby="metronome-title">
      <div className={styles.header}>
        <h2 id="metronome-title" className={styles.title}>Метроном</h2>
        <button type="button" className={styles.toggle} onClick={onToggle} disabled={previewing} aria-pressed={enabled}>
          {enabled ? 'Остановить метроном' : 'Включить метроном'}
        </button>
      </div>
      <div className={styles.controls}>
        <label className={styles.tempoControl}>
          <span className={styles.tempoLabel}>Темп <strong>{tempo} BPM</strong></span>
          <input type="range" min="40" max="200" step="1" value={tempo} disabled={tempoLocked} aria-label="Темп метронома" aria-valuetext={`${tempo} ударов в минуту`} onChange={(event) => onTempoChange(Number(event.target.value))} />
        </label>
        <div className={styles.beats} role="img" aria-label="Счёт на четыре, первая доля акцентированная" data-beat={enabled && beat !== null ? beat + 1 : 0}>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} aria-hidden="true" className={`${styles.beat} ${index === 0 ? styles.firstBeat : ''} ${enabled && beat === index ? styles.activeBeat : ''}`}>{index + 1}</span>
          ))}
        </div>
      </div>
      <p className={styles.hint}>Темп общий с образцом и оценкой ритма. Щелчки не попадают в запись.</p>
      {tempoLocked && <p className={styles.hint}>Менять темп можно в свободной игре, когда образец остановлен.</p>}
      {previewing && <p className={styles.hint}>Во время образца метроном выключен, чтобы не мешать мелодии.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  )
}
