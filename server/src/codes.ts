import { randomInt } from 'node:crypto'

// Karışması kolay I, L, O, U yok (Crockford base32)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LENGTH = 12

/** Kullanıcı girdisini normalize eder; geçersizse null. O→0, I/L→1 (yazım hatası toleransı). */
export function normalizeCode(input: string): string | null {
  const clean = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  return clean.length === CODE_LENGTH ? clean : null
}

/** Mobil uygulamadaki gösterimle aynı: MKP-XXXX-XXXX (ilk 8 hane) */
export function serialFromCode(code: string): string {
  return `MKP-${code.slice(0, 4)}-${code.slice(4, 8)}`
}

export function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
