export function createPiano(volume, longRelease) {
  const context = new AudioContext()
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  const voices = new Map()
  let releaseDuration = longRelease ? 0.8 : 0.18

  master.gain.value = volume * 0.7
  master.connect(compressor)
  compressor.connect(context.destination)

  function stop(source) {
    const voice = voices.get(source)
    if (!voice) return

    const now = context.currentTime
    voice.envelope.gain.cancelAndHoldAtTime(now)
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, now + releaseDuration)
    voice.oscillators.forEach((oscillator) => oscillator.stop(now + releaseDuration + 0.02))
    voices.delete(source)
  }

  function stopAll() {
    for (const source of voices.keys()) stop(source)
  }

  return {
    play(source, midi) {
      if (voices.has(source)) return Promise.resolve()

      const ready = context.resume()
      const now = context.currentTime
      const frequency = 440 * 2 ** ((midi - 69) / 12)
      const envelope = context.createGain()
      const harmonics = [
        { multiple: 1, level: 0.8, type: 'triangle' },
        { multiple: 2, level: 0.18, type: 'sine' },
        { multiple: 3, level: 0.06, type: 'sine' },
      ]

      envelope.gain.setValueAtTime(0.0001, now)
      envelope.gain.exponentialRampToValueAtTime(0.28, now + 0.008)
      envelope.gain.exponentialRampToValueAtTime(0.1, now + 0.3)
      envelope.gain.exponentialRampToValueAtTime(0.045, now + 1.8)
      envelope.connect(master)

      let remaining = harmonics.length
      const oscillators = harmonics.map(({ multiple, level, type }) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = type
        oscillator.frequency.value = frequency * multiple
        gain.gain.value = level
        oscillator.connect(gain)
        gain.connect(envelope)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
          remaining -= 1
          if (remaining === 0) envelope.disconnect()
        }
        oscillator.start(now)
        return oscillator
      })

      voices.set(source, { envelope, oscillators })
      return ready
    },
    stop,
    stopAll,
    setVolume(value) {
      master.gain.setTargetAtTime(value * 0.7, context.currentTime, 0.02)
    },
    setLongRelease(enabled) {
      releaseDuration = enabled ? 0.8 : 0.18
    },
    dispose() {
      stopAll()
      void context.close()
    },
  }
}
