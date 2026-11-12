import { useState } from 'react'
import { reviewDurations } from '../../mocks/reviewPreference.ts'
import type { ReviewDuration } from '../../mocks/reviewPreference.ts'
import type { Translate } from '../locales/messages.ts'
import { Icon } from './Icon.tsx'

export function ProtectionSettings({ saved, save, t }: {
  saved: ReviewDuration
  save: (duration: ReviewDuration) => boolean
  t: Translate
}) {
  const [selected, setSelected] = useState(saved)
  const [feedback, setFeedback] = useState<'protectionSaved' | 'protectionSaveFailed'>()

  return (
    <section id="payment-protection-settings" className="card side-card protection-settings"
      aria-labelledby="protection-heading" tabIndex={-1}>
      <div className="symbol mint"><Icon name="shield" /></div>
      <h2 id="protection-heading">{t('protectionSettings')}</h2>
      <p id="review-duration-help">{t('reviewDurationHelp')}</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        setFeedback(save(selected) ? 'protectionSaved' : 'protectionSaveFailed')
      }}>
        <fieldset aria-describedby="review-duration-help">
          <legend>{t('reviewDuration')}</legend>
          <div className="review-duration-options">
            {reviewDurations.map((duration) => (
              <label key={duration}>
                <input className="sr-only" type="radio" name="guardian-review-duration" value={duration}
                  checked={selected === duration} onChange={() => {
                    setSelected(duration)
                    setFeedback(undefined)
                  }} />
                <span>{duration} {t('reviewSeconds')}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="secondary">{t('saveProtection')}</button>
        <div role="status" className="settings-feedback">
          {feedback ? t(feedback) : ''}
        </div>
      </form>
    </section>
  )
}
