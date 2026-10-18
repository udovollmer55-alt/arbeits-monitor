import { test, expect } from 'claude-code/testing'
import { gruss } from '../hooks/register'

test('Gruß passt zur Tageszeit', () => {
  expect(gruss(8).text).toBe('Guten Morgen')
  expect(gruss(14).text).toBe('Hallo')
  expect(gruss(19).text).toBe('Guten Abend')
  expect(gruss(2).symbol).toBe('🌙')
})
