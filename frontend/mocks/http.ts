import type { IncomingMessage, ServerResponse } from 'node:http'

export class MockError extends Error {
  constructor(readonlyStatus: number, message: string) {
    super(message)
    this.status = readonlyStatus
  }

  readonly status: number
}

export async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 4096) throw new MockError(413, 'The demo request is too large.')
    chunks.push(buffer)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body
  } catch {
    throw new MockError(400, 'The demo request needs a JSON object.')
  }
}

export function respond(response: ServerResponse, now: number, status: number, body: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Date: new Date(now).toUTCString(),
  })
  response.end(JSON.stringify(body))
}
