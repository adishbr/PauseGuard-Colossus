import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getPayment, paymentError } from '../services/paymentApi.ts'
import { terminalStatuses } from '../types/payment.ts'
import type { Role } from '../types/payment.ts'

type Snapshot = Awaited<ReturnType<typeof getPayment>>
const pollMs = 1_000

export function usePayment(role: Role, token: string, id: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [error, setError] = useState<ApiError>()
  const [checking, setChecking] = useState(true)
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  const current = useRef<Snapshot | undefined>(undefined)

  const accept = useCallback((next: Snapshot) => {
    const previous = current.current?.payment
    if (previous && 'version' in previous && 'version' in next.payment && next.payment.version < previous.version) return
    generation.current += 1
    current.current = next
    setSnapshot(next)
    setError(undefined)
    setChecking(false)
  }, [])

  const refresh = useCallback(() => {
    generation.current += 1
    setChecking(true)
    setRetry((count) => count + 1)
  }, [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let request: AbortController | undefined
    let failures = 0

    async function poll() {
      if (!active || request || (current.current && terminalStatuses.has(current.current.payment.status))) return
      if (!navigator.onLine) {
        offline()
        return
      }

      const controller = new AbortController()
      request = controller
      const started = generation.current
      let retryRead = true
      try {
        const next = await getPayment(role, token, id, controller.signal)
        if (active && !controller.signal.aborted && generation.current === started) accept(next)
        failures = 0
      } catch (failure) {
        if (active && !controller.signal.aborted && generation.current === started) {
          const problem = paymentError(failure)
          setError(problem)
          setChecking(false)
          failures += 1
          retryRead = ![401, 403, 404].includes(problem.status)
          if (!retryRead) {
            current.current = undefined
            setSnapshot(undefined)
          }
        }
      } finally {
        if (request === controller) request = undefined
        if (active && retryRead && navigator.onLine && !controller.signal.aborted) {
          timer = setTimeout(poll, pollMs * 2 ** Math.min(failures, 3))
        }
      }
    }

    function offline() {
      if (current.current && terminalStatuses.has(current.current.payment.status)) return
      generation.current += 1
      clearTimeout(timer)
      request?.abort()
      setChecking(false)
      setError(new ApiError('offline'))
    }

    function reconnect() {
      if (!navigator.onLine) return
      if (current.current && terminalStatuses.has(current.current.payment.status)) return
      refresh()
    }

    void poll()
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', offline)
    window.addEventListener('focus', reconnect)
    return () => {
      active = false
      request?.abort()
      clearTimeout(timer)
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', offline)
      window.removeEventListener('focus', reconnect)
    }
  }, [accept, refresh, role, token, id, retry])

  return { snapshot, error, checking, accept, refresh }
}
