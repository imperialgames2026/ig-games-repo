import { test, expect } from '@playwright/test';

const games = [
 ['PlayPoker','Texas Hold’em Poker'],
 ['PlayOmaha','Omaha Poker'],
 ['PlayBlackjack','Multiplayer Blackjack'],
 ['PlayBaccarat','Multiplayer Baccarat'],
 ['PlayCraps','Multiplayer Craps'],
 ['PlayRoulette','Multiplayer Roulette'],
 ['PlayCrash','Multiplayer Crash'],
 ['PlayTrenball','Multiplayer Trenball'],
];

test('the public lobby offers exactly the targeted multiplayer table entry points', async ({page})=>{
 await page.goto('/Games', {waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Join a live casino-style table'})).toBeVisible();
 for(const [route,label] of games) {
   await expect(page.locator('a[href="/'+route+'"]').filter({hasText:label}).first()).toBeVisible();
 }
});

for(const [route,name] of games) {
 test(name+' does not expose a practice betting action without authentication',async ({page})=>{
   await page.goto('/'+route, {waitUntil:'domcontentloaded'});
   await expect(page).toHaveURL(/\/login(?:\?.*)?$/i);
   await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
   await expect(page.getByRole('button',{name:/Place practice bet|HIT|STAND|Deal hand/i})).toHaveCount(0);
 });
}

test('registration screen is reachable, but money transfers are not exposed',async ({page})=>{
 await page.goto('/login', {waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Create one'}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Email'})).toBeVisible();
 await expect(page.getByText('Deposit Crypto',{exact:true})).toHaveCount(0);
});

test('prize previews and Superadmin payout controls do not bypass authentication',async ({page})=>{
 for(const route of ['/PokerTournamentPrizes?eventId=00000000-0000-4000-8000-000000000000','/SuperadminPokerTournaments']){
   await page.goto(route, {waitUntil:'domcontentloaded'});
   await expect(page).toHaveURL(/\/login(?:\?.*)?$/i);
   await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
   await expect(page.getByRole('button',{name:/Save all .* payout positions/i})).toHaveCount(0);
 }
});

test('password recovery is reachable without an authenticated session',async({page})=>{
 await page.goto('/login',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Forgot password?'}).click();
 await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();
 await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Send reset link'})).toBeVisible();
 await page.goto('/ResetPassword',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('The reset link is missing or expired.',{exact:false})).toBeVisible();
});
