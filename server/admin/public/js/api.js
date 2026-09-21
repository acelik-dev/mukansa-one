import { ERRORS } from './fmt.js'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || ERRORS[code] || code)
    this.status = status
    this.code = code
  }
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Panel': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network')
  }
  if (res.status === 204) return null
  let json = null
  try {
    json = await res.json()
  } catch {
    // gövde yok
  }
  if (!res.ok) {
    if (res.status === 401 && json?.error === 'unauthorized') window.dispatchEvent(new Event('panel:unauthorized'))
    throw new ApiError(res.status, json?.error ?? 'unknown', json?.error === 'invalid_request' ? json.message : undefined)
  }
  return json
}

export const get = (p) => request('GET', p)
export const post = (p, b) => request('POST', p, b ?? {})
export const put = (p, b) => request('PUT', p, b)
export const del = (p) => request('DELETE', p)
