export const createWaveform = (width: number): number[] => {
  const data: number[] = []
  for (let i = 0; i < width; i += 1) {
    const value = 0.2 + Math.abs(Math.sin(i / 3)) * 0.8
    data.push(Number(value.toFixed(2)))
  }
  return data
}
