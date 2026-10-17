Deno.serve(async (req) => {
  const { bet, prediction } = await req.json();
  const roll = Math.floor(Math.random() * 100) + 1;
  const isWin = prediction === 'over' ? roll > 50 : roll < 50;
  const winAmount = isWin ? Math.round(bet * 1.96 * 100) / 100 : 0;
  const seed = crypto.randomUUID();
  return Response.json({ success: true, seed, hash: seed, roll, is_win: isWin, win_amount: winAmount });
});