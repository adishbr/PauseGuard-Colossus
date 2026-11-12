import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { demoReviewDurationHeader, reviewDurations } from '../mocks/reviewPreference.ts'
import { demoAccountPath } from '../src/types/account.ts'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PAUSEGUARD_TEST_ORIGIN || 'http://localhost:5173'

async function setup(t, options, sample = true) {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })
  t.after(() => browser.close())
  const context = await browser.newContext(options)
  const payer = await context.newPage()
  await payer.goto(origin + '/payer')
  if (sample) {
    await payer.getByRole('button', { name: 'Open sample payer' }).click()
    await payer.getByRole('heading', { name: 'Prepare a payment' }).waitFor()
  }
  return { browser, payer }
}

async function openReview(payer) {
  const guardian = await payer.context().newPage()
  await guardian.goto(origin + '/guardian/login')
  await guardian.getByRole('button', { name: 'Open sample guardian' }).click()
  await guardian.getByText('Waiting for a review request').waitFor()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await payer.getByRole('heading', { name: 'Waiting for your guardian' }).waitFor()
  await guardian.getByRole('button', { name: 'Open review' }).click()
  await guardian.getByRole('heading', { name: 'Review requested' }).waitFor()
  await assertFrosted(guardian.locator('.status-card'))
  return guardian
}

const completion = (page) => page.getByRole('heading', { name: 'Simulated payment completed' })

async function assertFrosted(panel) {
  assert.match(await panel.evaluate((element) => getComputedStyle(element).backdropFilter), /blur/)
}

test('public landing and distinct sign-in routes work on mobile without motion', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t, { viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' }, false)
  await payer.goto(origin)
  await payer.getByRole('heading', { name: 'A pause can protect a payment.' }).waitFor()
  assert.equal(await payer.getByLabel('Email or mobile').count(), 0)
  assert.equal(await payer.evaluate(() => document.documentElement.scrollWidth), 360)

  const lock = payer.locator('.woven-lock canvas[data-ready=true]')
  const firstFrame = await lock.screenshot()
  assert.deepEqual(await lock.screenshot(), firstFrame)

  await payer.getByRole('main').getByRole('link', { name: 'Get started' }).click()
  await payer.getByRole('heading', { name: 'Create your preview account' }).waitFor()
  assert.equal(new URL(payer.url()).pathname, '/payer/signup')
  await payer.goto(origin)
  await payer.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Guardian portal' }).click()
  await payer.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
  assert.equal(new URL(payer.url()).pathname, '/guardian/login')
  assert.equal(await payer.getByRole('button', { name: 'Open sample payer' }).count(), 0)
})

test('sign-in is centered frosted glass and the payer shares the homepage accent', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t, { viewport: { width: 1440, height: 900 } }, false)
  await payer.goto(origin)
  const logIn = payer.getByRole('link', { name: 'Log in', exact: true })
  const publicAccent = await payer.getByRole('banner').getByRole('link', { name: 'Get started' })
    .evaluate((link) => getComputedStyle(link).backgroundColor)
  await logIn.click()

  const card = payer.getByRole('region', { name: 'Sign in', exact: true })
  const style = await card.evaluate((panel) => {
    const bounds = panel.getBoundingClientRect()
    const stage = panel.parentElement.getBoundingClientRect()
    return {
      backdrop: getComputedStyle(panel).backdropFilter,
      xOffset: (bounds.left + bounds.right - stage.left - stage.right) / 2,
      yOffset: (bounds.top + bounds.bottom - stage.top - stage.bottom) / 2,
    }
  })
  assert.match(style.backdrop, /blur/)
  assert.ok(Math.abs(style.xOffset) < 1 && Math.abs(style.yOffset) < 1)

  await payer.getByRole('button', { name: 'Open sample payer' }).click()
  const payment = payer.getByRole('button', { name: 'Check payment', exact: true })
  assert.equal(await payment.evaluate((button) => getComputedStyle(button).backgroundColor), publicAccent)
  await assertFrosted(payer.locator('.payment-engine-card'))
  await assertFrosted(payer.locator('.payment-steps'))
  await assertFrosted(payer.getByRole('region', { name: 'Payment Protection Settings' }))

  const guardian = await payer.context().newPage()
  await guardian.goto(origin + '/guardian/login')
  await guardian.getByRole('button', { name: 'Open sample guardian' }).click()
  const radar = await guardian.locator('.inbox-icon-container').boundingBox()
  assert.ok(Math.abs(radar.width - radar.height) < 1)
  await assertFrosted(guardian.locator('.guardian-workspace-card'))
})

test('the admin entry still sends a signed-out visitor to admin login', { timeout: 15_000 }, async (t) => {
  const { payer } = await setup(t, undefined, false)
  await payer.goto(origin + '/admin')
  await payer.waitForURL('**/admin/login')
  await payer.getByRole('heading', { name: /admin/i }).waitFor()
  await assertFrosted(payer.locator('.admin-login-card'))
  assert.equal(await payer.getByRole('button', { name: 'Open sample payer' }).count(), 0)
})

test('same-browser windows approve a redacted review, reconnect, then confirm once', { timeout: 25_000 }, async (t) => {
  const { payer } = await setup(t)
  const guardian = await openReview(payer)
  const content = await guardian.locator('main').innerText()
  assert.doesNotMatch(content, /55,000|Willow Supplies|KYC or verification request/)
  assert.equal(await completion(payer).count(), 0)

  const readPattern = '**/api/v2/payments/pg_*'
  const failRead = (route) => route.abort()
  await payer.route(readPattern, failRead)
  await payer.getByRole('button', { name: 'Retry connection' }).waitFor()
  assert.equal(await payer.getByRole('button', { name: 'Stop this payment' }).isEnabled(), false)
  await guardian.getByRole('button', { name: 'Approve review' }).click()
  await guardian.getByRole('heading', { name: 'Review approved' }).waitFor()
  await payer.unroute(readPattern, failRead)
  await payer.getByRole('heading', { name: 'Ready for your confirmation' }).waitFor()
  assert.equal(await completion(payer).count(), 0)

  let confirmRequests = 0
  payer.on('request', (request) => {
    if (request.url().endsWith('/confirm')) confirmRequests += 1
  })
  await payer.getByRole('button', { name: 'Confirm simulated payment' }).dblclick()
  await completion(payer).waitFor()
  await payer.reload()
  await completion(payer).waitFor()
  assert.equal(await completion(payer).count(), 1)
  assert.equal(confirmRequests, 1)
})

test('separate browser profiles can find a request by reference and reject it', { timeout: 20_000 }, async (t) => {
  const { browser, payer } = await setup(t)
  const guardian = await (await browser.newContext()).newPage()
  await guardian.goto(`${origin}/guardian`)
  await guardian.getByRole('button', { name: 'Open sample guardian' }).click()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await payer.getByRole('heading', { name: 'Waiting for your guardian' }).waitFor()
  const reference = await payer.locator('.reference code').innerText()
  await guardian.getByLabel('Request reference').fill(reference)
  await guardian.getByRole('button', { name: 'Find request' }).click()
  await guardian.getByRole('button', { name: 'Reject payment' }).click()
  await payer.getByRole('heading', { name: 'Payment rejected' }).waitFor()
  await guardian.getByRole('heading', { name: 'Payment rejected' }).waitFor()
  assert.equal(await completion(payer).count(), 0)
})

test('saved guardian review durations expire safely in both windows', { concurrency: 3, timeout: 90_000 }, async (t) => {
  await Promise.all(reviewDurations.map((seconds) => t.test(`${seconds} seconds`, async (flow) => {
    const { payer } = await setup(flow)
    const settings = payer.getByRole('region', { name: 'Payment Protection Settings' })
    assert.equal(await settings.getByRole('radio').count(), 3)
    await settings.getByText(`${seconds} seconds`, { exact: true }).click()
    await settings.getByRole('button', { name: 'Save settings' }).click()
    await settings.getByRole('status').filter({ hasText: 'Guardian review duration saved.' }).waitFor()
    await payer.reload()
    assert.equal(await settings.getByRole('radio', { name: `${seconds} seconds`, exact: true }).isChecked(), true)
    if (seconds === 45) {
      await settings.getByRole('radio', { name: '60 seconds', exact: true }).focus()
      await payer.keyboard.press('Space')
    }

    const created = payer.waitForResponse((response) =>
      response.url().endsWith('/api/v2/payments') && response.request().method() === 'POST')
    const guardian = await openReview(payer)
    const response = await created
    const payment = await response.json()
    const deadline = Date.parse(payment.guardian_deadline)
    const serverDate = Date.parse(await response.headerValue('date'))
    assert.ok(Math.abs(deadline - serverDate - seconds * 1_000) < 1_200)
    assert.equal(await response.headerValue(demoReviewDurationHeader), String(seconds))

    async function checkCountdowns() {
      const timers = [payer, guardian].map((page) => page.locator('.timer-value'))
      const reads = await Promise.all(timers.map(async (timer) => {
        assert.equal(await timer.getAttribute('datetime'), payment.guardian_deadline)
        const [minutes, remaining] = (await timer.innerText()).split(':').map(Number)
        return minutes * 60 + remaining
      }))
      const expected = Math.ceil((deadline - Date.now()) / 1_000)
      assert.ok(reads.every((remaining) => remaining > 0 && Math.abs(remaining - expected) <= 2))
      assert.ok(Math.abs(reads[0] - reads[1]) <= 2)
      for (const page of [payer, guardian]) {
        assert.equal(await page.locator('.timer progress').getAttribute('max'), String(seconds))
      }
    }

    await checkCountdowns()
    if (seconds === 45) {
      // Saving a new preference applies to future reviews, even after a reload.
      await settings.getByRole('button', { name: 'Save settings' }).click()
      await Promise.all([payer.reload(), guardian.reload()])
      await payer.getByRole('heading', { name: 'Waiting for your guardian' }).waitFor()
      await guardian.getByRole('heading', { name: 'Review requested' }).waitFor()
      assert.equal(await settings.getByRole('radio', { name: '60 seconds', exact: true }).isChecked(), true)
      await checkCountdowns()
      await payer.context().setOffline(true)
      await payer.getByRole('heading', { name: 'Payment status unavailable' }).waitFor()
      await guardian.getByRole('heading', { name: 'Payment status unavailable' }).waitFor()
      await payer.context().setOffline(false)
      await payer.getByRole('heading', { name: 'Waiting for your guardian' }).waitFor()
      await guardian.getByRole('heading', { name: 'Review requested' }).waitFor()
      await checkCountdowns()
    }

    await Promise.all([payer, guardian].map((page) =>
      page.getByRole('heading', { name: 'Review window closed' }).waitFor({ timeout: (seconds + 8) * 1_000 })))
    assert.equal(await guardian.getByRole('button', { name: 'Approve review' }).count(), 0)
    assert.equal(await payer.getByRole('button', { name: 'Confirm simulated payment' }).count(), 0)
    const token = await payer.evaluate(() => sessionStorage.getItem('pauseguard:demo:session:payer'))
    const status = await payer.request.get(`${origin}/api/v2/payments/${payment.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal((await status.json()).status, 'AWAITING_FALLBACK_REVIEW')
    await payer.getByRole('button', { name: 'Stop this payment' }).click()
    await payer.getByRole('heading', { name: 'Payment stopped' }).waitFor()
  })))
})

test('mobile keyboard entry and retry preserve the original creation key after a lost response', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t, { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true })
  assert.equal(await payer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  const settings = payer.getByRole('region', { name: 'Payment Protection Settings' })
  await payer.getByRole('link', { name: 'Payment Protection Settings' }).click()
  await settings.getByText('45 seconds', { exact: true }).click()
  await settings.getByRole('button', { name: 'Save settings' }).click()
  await payer.getByRole('button', { name: 'Everyday purchase' }).click()
  const amount = payer.getByRole('textbox', { name: 'Amount (INR)' })
  assert.equal(await amount.getAttribute('inputmode'), 'decimal')
  await amount.focus()
  await payer.keyboard.press('ControlOrMeta+a')
  await payer.keyboard.type('100.05')
  const presets = payer.getByRole('group', { name: 'Preset amount shortcuts' }).getByRole('button')
  for (const preset of await presets.all()) {
    await payer.keyboard.press('Tab')
    assert.equal(await preset.evaluate((button) => button === document.activeElement), true)
  }
  await payer.keyboard.press('Tab')
  assert.equal(await payer.evaluate(() => document.activeElement.name), 'beneficiary')

  const attempts = []
  const durationHints = []
  let firstId
  await payer.route('**/api/v2/payments', async (route) => {
    attempts.push(route.request().postDataJSON())
    durationHints.push(route.request().headers()[demoReviewDurationHeader])
    if (attempts.length === 1) {
      const response = await route.fetch()
      firstId = (await response.json()).id
      await route.abort()
    } else {
      await route.continue()
    }
  })
  await payer.keyboard.press('Tab')
  await payer.keyboard.press('Tab')
  await payer.keyboard.press('Enter')
  await payer.getByRole('alert').filter({ hasText: /demo API is unavailable/ }).waitFor()
  await settings.getByText('60 seconds', { exact: true }).click()
  await settings.getByRole('button', { name: 'Save settings' }).click()
  await payer.reload()
  await payer.getByRole('button', { name: 'Retry this request' }).click()
  await payer.getByRole('heading', { name: 'Ready for your confirmation' }).waitFor()
  assert.equal(await payer.locator('.reference code').innerText(), firstId)
  assert.deepEqual(attempts[0], attempts[1])
  assert.deepEqual(Object.keys(attempts[0]).sort(), ['amount_paise', 'beneficiary_id', 'idempotency_key', 'purpose'])
  assert.deepEqual(durationHints, ['45', '45'])
  assert.equal(attempts[0].amount_paise, 10_005)
  await payer.getByRole('button', { name: 'Stop this payment' }).click()
  await payer.getByRole('heading', { name: 'Payment stopped' }).waitFor()
})

test('mobile localization preserves the draft and presents validation, focus and reduced motion', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t, { viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' })
  const language = payer.locator('.locale-control select')
  const amount = payer.locator('#amount')
  const warning = payer.getByRole('alert')
  await amount.fill('0')
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await warning.filter({ hasText: 'Enter a positive rupee amount' }).waitFor()
  assert.equal(await amount.getAttribute('aria-invalid'), 'true')
  assert.equal(await amount.evaluate((element) => element === document.activeElement), true)
  assert.equal(await payer.locator('.amount-field').evaluate((el) => getComputedStyle(el).outlineStyle), 'solid')
  assert.equal(await payer.locator('.workspace-card').evaluate((el) => getComputedStyle(el).animationName), 'none')
  await amount.fill('100.05')
  for (const [locale, family, sample] of [
    ['kn', 'Noto Sans Kannada Variable', 'ಕನ್ನಡ'],
    ['hi', 'Noto Sans Devanagari Variable', 'हिन्दी'],
    ['te', 'Noto Sans Telugu Variable', 'తెలుగు'],
  ]) {
    await language.selectOption(locale)
    await payer.waitForFunction((lang) => document.documentElement.lang === lang, locale)
    const loaded = await payer.evaluate(async ([font, text]) => {
      const faces = await document.fonts.load(`600 20px "${font}"`, text)
      return faces.some((face) => face.status === 'loaded')
    }, [family, sample])
    assert.equal(loaded, true)
    assert.equal(await amount.inputValue(), '100.05')
    assert.equal(await payer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  }
  await payer.reload()
  await payer.waitForFunction(() => document.documentElement.lang === 'te')
  await language.selectOption('en')
  await payer.getByRole('heading', { name: 'Prepare a payment' }).waitFor()
})

test('warning guidance and a lost confirmation response resolve to the authoritative outcome', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t)
  await payer.getByRole('button', { name: 'Unfamiliar supplier' }).click()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await payer.getByRole('heading', { name: 'Review this payment' }).waitFor()
  await assertFrosted(payer.locator('.status-card.tone-caution'))
  assert.equal(await payer.locator('[aria-current="step"]').innerText(), '02\nReview')
  await payer.getByText('How to verify the request', { exact: true }).click()
  await payer.getByText(/Contact the recipient using a saved number/).waitFor()
  await payer.getByRole('button', { name: 'I verified the recipient' }).click()
  await payer.getByRole('heading', { name: 'Ready for your confirmation' }).waitFor()
  assert.equal(await completion(payer).count(), 0)

  let confirmationPosts = 0
  await payer.route('**/confirm', async (route) => {
    confirmationPosts += 1
    await route.fetch()
    await route.abort()
  })
  await payer.getByRole('button', { name: 'Confirm simulated payment' }).click()
  await completion(payer).waitFor()
  await assertFrosted(payer.locator('.status-card'))
  assert.equal(confirmationPosts, 1)
  assert.equal(await payer.locator('[aria-current="step"]').innerText(), '03\nOutcome')
  assert.equal(await payer.getByRole('alert').count(), 0)
  await payer.getByRole('button', { name: 'Start another payment' }).click()
  assert.equal(await payer.getByRole('heading', { name: 'Prepare a payment' }).evaluate((el) => el === document.activeElement), true)
})

test('guardian rejects an unexpected private response and recovers on a clean status check', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t)
  const guardian = await openReview(payer)
  const readPattern = '**/api/v2/payments/pg_*'
  const leakedRead = async (route) => {
    const response = await route.fetch()
    const payment = await response.json()
    await route.fulfill({ response, json: { ...payment, amount_paise: 5_500_000, beneficiary_id: 'Willow Supplies' } })
  }
  await guardian.route(readPattern, leakedRead)
  await guardian.getByRole('heading', { name: 'Payment status unavailable' }).waitFor()
  assert.doesNotMatch(await guardian.locator('main').innerText(), /55,000|Willow Supplies/)
  assert.equal(await guardian.getByRole('button', { name: 'Approve review' }).isEnabled(), false)
  await guardian.unroute(readPattern, leakedRead)
  await guardian.getByRole('button', { name: 'Retry connection' }).click()
  await guardian.getByRole('heading', { name: 'Review requested' }).waitFor()
  assert.equal(await guardian.getByRole('button', { name: 'Approve review' }).isEnabled(), true)
})

test('flagged demo recipient is rejected without opening a guardian request', { timeout: 20_000 }, async (t) => {
  const { payer } = await setup(t)
  await payer.getByRole('button', { name: 'Flagged recipient' }).click()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await payer.getByRole('heading', { name: 'Payment rejected' }).waitFor()
  await assertFrosted(payer.locator('.status-card.tone-danger'))
  await payer.getByText(/A safety rule stopped this request/).waitFor()
  assert.equal(await payer.getByRole('button', { name: 'Confirm simulated payment' }).count(), 0)
  assert.equal(await payer.evaluate(() => localStorage.getItem('pauseguard:demo:guardian-request')), null)
})

async function signUp(page, name, contact) {
  await page.getByRole('link', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email or mobile').fill(contact)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Create account' }).click()
}

test('new payer onboards on mobile, edits profile, and signs back in', { timeout: 30_000 }, async (t) => {
  const { payer } = await setup(t, { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }, false)
  await payer.getByRole('link', { name: 'Sign up', exact: true }).focus()
  await payer.keyboard.press('Enter')
  await payer.getByRole('button', { name: 'Continue' }).click()
  await payer.getByRole('alert').filter({ hasText: 'fictional full name' }).waitFor()
  assert.equal(await payer.getByLabel('Full name').evaluate((input) => input === document.activeElement), true)
  await payer.getByLabel('Full name').fill('Mobile Demo')
  await payer.getByLabel('Email or mobile').fill('invalid-contact')
  await payer.getByRole('button', { name: 'Continue' }).click()
  await payer.getByRole('alert').filter({ hasText: 'valid email address' }).waitFor()
  const contact = `mobile-${crypto.randomUUID()}@gmail.com`
  await payer.getByLabel('Email or mobile').fill(contact)
  await payer.getByRole('button', { name: 'Continue' }).click()
  await payer.getByLabel('Account type').selectOption('small_business')
  await payer.getByLabel('Organization (optional)').fill('Example Studio')
  await payer.getByRole('button', { name: 'Create account' }).click()
  await payer.getByRole('heading', { name: 'Prepare a payment' }).waitFor()
  await payer.getByRole('link', { name: 'Profile', exact: true }).click()
  await payer.getByLabel('Full name').fill('Edited Demo')
  await payer.getByLabel('Recurring supplier (optional)').selectOption('supplier_new')
  await payer.getByLabel('Quiet hours start (optional)').fill('22:00')
  await payer.getByLabel('Quiet hours end (optional)').fill('06:00')
  await payer.getByText('I opt in to simulated guardian call preferences').click()
  await payer.getByText('Use larger text').click()
  await payer.getByRole('button', { name: 'Save profile' }).click()
  await payer.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor()
  await payer.reload()
  assert.equal(await payer.getByLabel('Full name').inputValue(), 'Edited Demo')
  assert.equal(await payer.getByLabel('Recurring supplier (optional)').inputValue(), 'supplier_new')
  assert.equal(await payer.getByLabel('I opt in to simulated guardian call preferences').isChecked(), true)
  assert.equal(await payer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await payer.getByRole('button', { name: 'Turn on Safe-Lock' }).click()
  await payer.getByRole('heading', { name: 'Safe-Lock is on' }).waitFor()
  await payer.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await payer.getByRole('button', { name: 'Everyday purchase' }).click()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await payer.getByRole('heading', { name: 'Payment rejected' }).waitFor()
  await payer.getByRole('button', { name: 'Sign out' }).click()
  await payer.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
  assert.equal(new URL(payer.url()).pathname, '/payer/login')
  await payer.getByLabel('Email or mobile').fill(contact)
  await payer.getByRole('button', { name: 'Sign in to preview' }).click()
  await payer.getByText('Signed in as Edited Demo').waitFor()

  const token = await payer.evaluate(() => sessionStorage.getItem('pauseguard:demo:session:payer'))
  await payer.request.delete(origin + demoAccountPath + '/session', { headers: { Authorization: `Bearer ${token}` } })
  await payer.reload()
  await payer.getByRole('alert').filter({ hasText: 'Your demo session expired' }).waitFor()
})

test('separate enrolled guardian declines, accepts, and loses access after revocation', { timeout: 35_000 }, async (t) => {
  const { browser, payer } = await setup(t, undefined, false)
  const suffix = crypto.randomUUID()
  const contact = `guardian-${suffix}@fixture.test`
  await signUp(payer, 'Invite Payer', `payer-${suffix}@fixture.test`)
  await payer.getByRole('link', { name: 'Guardians', exact: true }).click()
  await payer.getByText('No guardian enrolled.').waitFor()
  async function invite() {
    const optIn = payer.getByLabel('I want to invite a trusted guardian')
    if (!await optIn.isChecked()) await optIn.check()
    await payer.getByLabel('Guardian name').fill('Invite Guardian')
    await payer.getByLabel('Relationship').selectOption('Family')
    await payer.getByLabel('Guardian demo email or mobile').fill(contact)
    const consent = payer.getByLabel('I consent to sharing the limited review details after this guardian accepts.')
    await consent.uncheck()
    await payer.getByRole('button', { name: 'Send demo invitation' }).click()
    await payer.getByRole('alert').filter({ hasText: 'sharing consent' }).waitFor()
    await consent.check()
    await payer.getByRole('button', { name: 'Send demo invitation' }).click()
    await payer.getByText('Pending', { exact: true }).waitFor()
  }
  await invite()
  const guardian = await (await browser.newContext()).newPage()
  await guardian.goto(await payer.getByLabel('Guardian invitation link').inputValue())
  await signUp(guardian, 'Invite Guardian', contact)
  await guardian.getByText('Pending', { exact: true }).waitFor()
  assert.equal(await guardian.getByRole('button', { name: 'Accept invitation' }).isEnabled(), false)
  await guardian.getByRole('button', { name: 'Decline invitation' }).click()
  await guardian.getByText('Declined', { exact: true }).waitFor()
  await payer.getByRole('button', { name: 'Refresh invitation status' }).click()
  await payer.getByText('Declined', { exact: true }).waitFor()
  await invite()
  await guardian.getByRole('button', { name: 'Refresh invitation status' }).click()
  await guardian.getByLabel('I agree to receive privacy-limited review requests from this payer.').check()
  await guardian.getByRole('button', { name: 'Accept invitation' }).click()
  await guardian.getByText('Accepted', { exact: true }).waitFor()
  await guardian.getByRole('link', { name: 'Reviews', exact: true }).click()
  await payer.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await payer.getByRole('button', { name: 'Check payment', exact: true }).click()
  await guardian.getByRole('button', { name: 'Open review' }).click()
  await guardian.getByRole('heading', { name: 'Review requested' }).waitFor()
  assert.doesNotMatch(await guardian.locator('main').innerText(), /55,000|Willow Supplies|KYC or verification request/)
  await payer.getByRole('link', { name: 'Guardians', exact: true }).click()
  await payer.getByRole('button', { name: 'Revoke guardian access' }).click()
  await payer.getByText('Revoked', { exact: true }).waitFor()
  await guardian.getByRole('heading', { name: 'Payment status unavailable' }).waitFor()
  assert.equal(await guardian.getByRole('button', { name: 'Approve review' }).count(), 0)
  await payer.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await payer.getByRole('heading', { name: 'Review window closed' }).waitFor()
  assert.equal(await payer.getByRole('button', { name: 'Confirm simulated payment' }).count(), 0)
})
