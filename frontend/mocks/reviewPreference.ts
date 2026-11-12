export const reviewDurations = [30, 45, 60] as const
export type ReviewDuration = typeof reviewDurations[number]

export const defaultReviewDuration = reviewDurations[0]
export const demoReviewDurationHeader = 'x-pauseguard-demo-review-seconds'

export function parseReviewDuration(value: unknown) {
  return reviewDurations.find((duration) => value === duration || value === String(duration))
}
