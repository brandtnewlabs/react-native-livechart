import { formatValue, formatTime } from './format'

describe('formatValue', () => {
  it('formats zero', () => {
    expect(formatValue(0)).toBe('0')
  })

  it('formats small decimals with 4 significant digits', () => {
    expect(formatValue(0.003456)).toBe('0.003456')
    expect(formatValue(0.5)).toBe('0.5000')
    expect(formatValue(0.12345)).toBe('0.1235')
  })

  it('formats 1-99 with 2 decimals', () => {
    expect(formatValue(1)).toBe('1.00')
    expect(formatValue(42.567)).toBe('42.57')
    expect(formatValue(99.999)).toBe('100.00')
  })

  it('formats 100-999 with 1 decimal', () => {
    expect(formatValue(100)).toBe('100.0')
    expect(formatValue(150.36)).toBe('150.4')
    expect(formatValue(999.9)).toBe('999.9')
  })

  it('formats thousands with K suffix', () => {
    expect(formatValue(1000)).toBe('1.00K')
    expect(formatValue(1200)).toBe('1.20K')
    expect(formatValue(5500)).toBe('5.50K')
    expect(formatValue(15000)).toBe('15.0K')
    expect(formatValue(67542)).toBe('67.5K')
    expect(formatValue(100000)).toBe('100K')
    expect(formatValue(999999)).toBe('1000K')
  })

  it('formats millions with M suffix', () => {
    expect(formatValue(1_000_000)).toBe('1.00M')
    expect(formatValue(1_500_000)).toBe('1.50M')
    expect(formatValue(15_000_000)).toBe('15.0M')
    expect(formatValue(100_000_000)).toBe('100M')
  })

  it('handles negative values', () => {
    expect(formatValue(-42.5)).toBe('-42.50')
    expect(formatValue(-3200)).toBe('-3.20K')
    expect(formatValue(-1_500_000)).toBe('-1.50M')
    expect(formatValue(-0.005)).toBe('-0.005000')
  })
})

describe('formatTime', () => {
  it('formats unix seconds as HH:MM:SS', () => {
    const noon = new Date()
    noon.setHours(12, 30, 45, 0)
    const t = noon.getTime() / 1000
    expect(formatTime(t)).toBe('12:30:45')
  })

  it('pads single digits', () => {
    const early = new Date()
    early.setHours(1, 5, 9, 0)
    const t = early.getTime() / 1000
    expect(formatTime(t)).toBe('01:05:09')
  })
})
