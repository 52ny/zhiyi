import { test, expect } from '@playwright/test';

test('演示模式补齐资料并显示提示条', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.locator('#demo-bar')).toBeVisible();
  await expect(page.locator('.doc-card, .dcard').first()).toBeVisible();
  const titles = await page.locator('.doc-card h3, .dcard h3').allTextContents();
  expect(titles.join(' ')).toContain('论语');
});

test('打开文言文资料并显示语言标签与正文', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.locator('.doc-card, .dcard').filter({ hasText: '论语' }).first().click();
  await expect(page.locator('.paper')).toBeVisible();
  await expect(page.locator('.paper')).toContainText('孟懿子问孝');
  await expect(page.locator('.doc-head')).toContainText('文言文');
});

test('复习页可渲染到期卡片', async ({ page }) => {
  await page.goto('/?demo=1#/review');
  await expect(page.locator('h1')).toContainText('今天该记住什么');
  await expect(page.locator('body')).toContainText('遗忘曲线');
});
