export function createMetronome(onBeat) {
  const context = new AudioContext()
  const clicks = new Set()
  const visualTimers = new Set()
  let scheduler = null
  let running = false
  let revision = 0
  let tempo = 96
  let nextTime = 0
  let nextBeat = 0

  function clearSchedule() {
    revision += 1
    clearInterval(scheduler)
    scheduler = null
    visualTimers.forEach((timer) => clearTimeout(timer))
    visualTimers.clear()
    clicks.forEach(({ oscillator, gain }) => {
      gain.gain.cancelScheduledValues(context.currentTime)
      gain.gain.setValueAtTime(0, context.currentTime)
      oscillator.stop()
    })
    clicks.clear()
  }

  function scheduleClick(time, beat) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const click = { oscillator, gain }
    oscillator.frequency.value = beat === 0 ? 1500 : 1000
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.12, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045)
    oscillator.connect(gain)
    // The metronome has its own output, separate from the piano recording stream.
    gain.connect(context.destination)
    clicks.add(click)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      clicks.delete(click)
    }
    oscillator.start(time)
    oscillator.stop(time + 0.05)

    const currentRevision = revision
    const timer = setTimeout(() => {
      visualTimers.delete(timer)
      if (running && revision === currentRevision) onBeat(beat)
    }, Math.max(0, (time - context.currentTime) * 1000))
    visualTimers.add(timer)
  }

  function schedule() {
    if (!running) return
    const interval = 60 / tempo
    if (nextTime < context.currentTime) {
      const skipped = Math.ceil((context.currentTime - nextTime) / interval)
      nextTime += skipped * interval
      nextBeat = (nextBeat + skipped) % 4
    }
    while (nextTime < context.currentTime + 0.1) {
      scheduleClick(nextTime, nextBeat)
      nextTime += interval
      nextBeat = (nextBeat + 1) % 4
    }
  }

  function resetSchedule() {
    clearSchedule()
    nextTime = context.currentTime + 0.05
    nextBeat = 0
    schedule()
    scheduler = setInterval(schedule, 25)
  }

  function stop() {
    running = false
    clearSchedule()
  }

  return {
    async start(value) {
      stop()
      tempo = value
      const currentRevision = revision
      await context.resume()
      if (revision !== currentRevision) return false
      running = true
      resetSchedule()
      return true
    },
    setTempo(value) {
      tempo = value
      if (running) resetSchedule()
    },
    stop,
    dispose() {
      stop()
      void context.close()
    },
  }
}
