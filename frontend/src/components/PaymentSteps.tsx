import type { MessageKey } from '../locales/en.ts'
import type { Translate } from '../locales/messages.ts'
import { Icon } from './Icon.tsx'

const steps: MessageKey[] = ['prepare', 'review', 'outcome']

export function PaymentSteps({ current, t }: { current: 0 | 1 | 2; t: Translate }) {
  return (
    <ol className="payment-steps glass-surface" aria-label={t('journey')}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'step-done' : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="step-marker" aria-hidden="true">
            {index < current ? <Icon name="check" size={14} /> : `0${index + 1}`}
          </span>
          {t(step)}
        </li>
      ))}
    </ol>
  )
}
