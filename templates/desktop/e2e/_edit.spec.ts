// temp: full interaction proof
import { test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 860 } })

test('editing interactions', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(700)
  await page.locator('.act-btn[data-section="studio"]').click()
  await page.waitForTimeout(500)
  // 空格播放 → 播放头推进
  await page.keyboard.press('Space')
  await page.waitForTimeout(1600)
  const playheadLeft = await page.evaluate(
    () => document.getElementById('st-playhead')?.style.left,
  )
  await page.keyboard.press('Space')
  console.log('PLAYHEAD=' + playheadLeft)
  // 素材添加 + clip 拖动移动
  await studio_click(page, '旁白配音')
  const lane = page.locator('.st-lane-row[data-track="音频轨"] .st-lane')
  const before = await lane.locator('.st-clip').first().boundingBox()
  await lane.locator('.st-clip').first().hover()
  await page.mouse.down()
  await page.mouse.move((before?.x ?? 0) + 120, (before?.y ?? 0) + 10, { steps: 6 })
  await page.mouse.up()
  const after = await lane.locator('.st-clip').first().boundingBox()
  console.log(
    'DRAG_DX=' +
      Math.round((after?.x ?? 0) - (before?.x ?? 0)) +
      ' CLIPS_AUDIO=' +
      (await lane.locator('.st-clip').count()),
  )
  // 分割 + 删除
  await page.locator('.st-clip', { hasText: '城市航拍' }).click()
  await page.keyboard.press('s')
  const clipsVideo = await page
    .locator('.st-lane-row[data-track="视频主轨"] .st-clip')
    .count()
  console.log('AFTER_SPLIT=' + clipsVideo)
  await page.keyboard.press('Delete')
  console.log(
    'AFTER_DELETE=' +
      (await page.locator('.st-lane-row[data-track="视频主轨"] .st-clip').count()),
  )
  await page.screenshot({ path: 'test-results/editing-proof.png' })
})

async function studio_click(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.locator('.st-lib-item', { hasText: name }).click()
  await page.waitForTimeout(200)
}
