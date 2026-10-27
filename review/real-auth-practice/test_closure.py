"""Offline source contract checks only; no SQL execution or service emulator."""
import importlib.util,json,pathlib,re,unittest
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('bundle',HERE/'build_bundle.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Closure(unittest.TestCase):
 def test_sources_hashes_and_stage_order(self):
  text=b.build();self.assertTrue(text.startswith('-- REVIEW ONLY.'));self.assertTrue(text.endswith('commit;\n'))
  self.assertLess(text.index('REAL_AUTH_AND_REVIEWED_CLAIM_HELPERS_REQUIRED'),text.index('create table if not exists public.ig_mp_tables'))
  self.assertNotIn('select cron.schedule(',text)
  self.assertNotIn('alter table public.ig_hand_analysis_receipts',text)
 def test_real_auth_is_required_never_replaced_or_mocked(self):
  sql=b.build().lower()
  for forbidden in ['create table auth.users','create schema auth','insert into auth.users','create function auth.jwt','create function auth.uid','create or replace function auth.','create table public.wallets','create table public.transactions','create table public.ign_accounts']:
   self.assertNotIn(forbidden,sql)
  app=(HERE/'app-schema.sql').read_text();self.assertIn("to_regclass('auth.identities')",app);self.assertIn("to_regclass('auth.sessions')",app)
  self.assertIn("values(new.id,'player')",app);self.assertNotIn('raw_user_meta_data',app)
 def test_eight_engine_descriptors_and_basic_handler_table_dependencies(self):
  m=json.loads((HERE/'engine-fixtures.json').read_text());self.assertEqual({x['game'] for x in m['engines']},{'Holdem','Omaha','Blackjack','Baccarat','Craps','Roulette','Crash','Trenball'})
  self.assertTrue(all(x['handler'] not in ['ig-slot-practice-v1','ig-originals-practice','ig-mines-practice'] for x in m['engines']))
  sql=b.build()
  for handler in {x['handler'] for x in m['engines']}|{'poker-events-v1','admin-poker-events'}:
   source=(b.ROOT/'supabase/functions'/handler/'index.ts').read_text()
   for table in set(re.findall(r'\.from\("([a-z_0-9]+)"',source)):
    self.assertRegex(sql,r'(?i)create table(?: if not exists)? public\.'+table+r'\b',handler+': '+table)
 def test_no_financial_signup_or_mutation_grants_to_players(self):
  app=(HERE/'app-schema.sql').read_text();trigger=app[app.index('create function ig_practice_fixture.on_real_auth_signup'):]
  self.assertEqual(len(re.findall(r'insert into public\.',trigger)),2)
  self.assertNotRegex(app,r'grant (?:all|insert|update|delete)[^;]* to authenticated')
  self.assertIn('using(id=(select auth.uid()))',app);self.assertIn('using(user_id=(select auth.uid()))',app)
 def test_oracle_requires_actual_nonempty_trace_and_private_ledger(self):
  oracle=(HERE/'accounting-oracle.sql').read_text()
  self.assertIn('NONEMPTY_ACTUAL_HTTP_TRACE_REQUIRED',oracle)
  self.assertIn('REVIEWED_LEDGER_PROPOSAL_REQUIRED',oracle)
  self.assertIn("actor_id=(item->>'actorId')::uuid",oracle)
  self.assertIn("request_ref=item->>'requestId'",oracle)
  self.assertNotRegex(oracle,r'(?i)create (?:or replace )?function|grant ')
if __name__=='__main__':unittest.main()
