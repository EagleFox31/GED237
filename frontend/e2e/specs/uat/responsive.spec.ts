import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { SEED } from '../../data/seed';

/**
 * Controle responsive (CDC) : aucun debordement horizontal aux largeurs 375, 768 et 1280 px
 * sur les ecrans de demo, et le contenu principal reste visible.
 * Donnees : seed e2e (admin MINFI001, collaborateur MINFI002). Lecture seule, pas de captures.
 * Les ecarts sont tous remontes (expect.soft) avec l'ecran, la largeur et les elements fautifs.
 */
const WIDTHS = [375, 768, 1280] as const;

interface Screen {
  name: string;
  path: string;
  role: 'tenant_admin' | 'collaborator';
}

const SCREENS: Screen[] = [
  { name: 'tableau de bord admin (OrgDashboard)', path: 'dashboard', role: 'tenant_admin' },
  { name: 'Espaces', path: 'spaces', role: 'tenant_admin' },
  { name: 'documents / recherche', path: 'documents', role: 'tenant_admin' },
  { name: 'journal d\'audit', path: 'audit', role: 'tenant_admin' },
  { name: 'Atelier (collaborateur)', path: 'dashboard', role: 'collaborator' },
];

/** Elements wider than the viewport, innermost first, to name the culprit. */
async function overflow(page: Page): Promise<{ over: number; culprits: string[] }> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const limit = doc.clientWidth;
    const culprits: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= limit + 1) continue;
      if (getComputedStyle(el).position === 'fixed') continue;
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      culprits.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} (droite=${Math.round(r.right)})`);
      if (culprits.length >= 5) break;
    }
    return { over: doc.scrollWidth - limit, culprits };
  });
}

async function check(page: Page, label: string, width: number) {
  const { over, culprits } = await overflow(page);
  expect.soft(over, `${label} @${width}px : debordement horizontal de ${over}px ; elements : ${culprits.join(' | ') || 'aucun identifie'}`).toBeLessThanOrEqual(0);
}

// Probe: proves the detector sees an overflow (a test that cannot fail proves nothing).
test('sonde - le detecteur signale un debordement', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.setContent('<div id="wide" style="width:900px;height:10px">x</div>');
  const { over, culprits } = await overflow(page);
  expect(over).toBeGreaterThan(0);
  expect(culprits.join()).toContain('div');
});

for (const width of WIDTHS) {
  test.describe(`Feature: Responsive @${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.slow();

    test(`login @${width}px`, async ({ page, loginPage }) => {
      await loginPage.goto();
      await expect(loginPage.submitButton).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await check(page, 'login', width);
    });

    for (const role of ['tenant_admin', 'collaborator'] as const) {
      test(`ecrans ${role} @${width}px`, async ({ page, loginAs }) => {
        await loginAs(role);
        for (const s of SCREENS.filter((x) => x.role === role)) {
          await page.goto(s.path);
          await expect.soft(page, `${s.name} @${width}px : ecran atteint`).toHaveURL(new RegExp(`/${s.path}$`));
          await expect.soft(page.locator('#institution'), `${s.name} @${width}px : session perdue`).toHaveCount(0);
          await expect.poll(async () => (await page.locator('body').innerText()).length, { message: `${s.name} @${width}px : contenu rendu` }).toBeGreaterThan(200);
          await check(page, s.name, width);
        }
        if (role === 'tenant_admin') {
          // Detail d'un document : la modale doit tenir dans la largeur.
          await page.goto('documents');
          const row = page.getByText(SEED.documents.find((d) => d.code === 'E2E-VAL-VISA')!.title).first();
          await expect(row, `detail document @${width}px : au moins un document`).toBeVisible();
          await row.click({ timeout: 5000 }).catch((e: Error) => {
            const hit = e.message.split(String.fromCharCode(10)).find((l) => l.includes('intercepts pointer events')) ?? e.message.slice(0, 160);
            expect.soft(hit.trim().slice(0, 220), `detail document @${width}px : clic impossible`).toBe('');
          });
          await expect.soft(page.getByText('Circuit de Validation'), `detail document @${width}px : detail visible`).toBeVisible();
          await check(page, 'detail document', width);
        }
      });
    }
  });
}

// A fixed panel (sidebar) must not hide most of a narrow screen.
for (const width of [375, 768] as const) {
  test(`barre laterale fixe @${width}px : ne recouvre pas plus de la moitie de l'ecran`, async ({ page, loginAs }) => {
    await page.setViewportSize({ width, height: 800 });
    await loginAs('tenant_admin');
    await page.goto('dashboard');
    const covered = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
        .filter((el) => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > innerHeight * 0.8)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 3).join('.')} = ${Math.round((100 * el.getBoundingClientRect().width) / w)} % de la largeur`);
    });
    expect.soft(covered.length ? Math.max(...covered.map((c) => Number(c.match(/= (\d+) %/)![1]))) : 0, `panneau fixe @${width}px : ${covered.join(' | ')}`).toBeLessThanOrEqual(50);
  });
}
