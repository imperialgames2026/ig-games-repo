import hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
s=importlib.util.spec_from_file_location('worker',Path(__file__).with_name('worker.py'));worker=importlib.util.module_from_spec(s);s.loader.exec_module(worker)
class Tests(unittest.TestCase):
 def test_config_is_private(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'config.json';p.write_text('{}');p.chmod(0o644)
   with self.assertRaises(ValueError):worker.read_json_private(p)
   p.chmod(0o600);self.assertEqual(worker.read_json_private(p),{})
 def test_foreign_or_unsigned_evidence_is_rejected_before_network(self):
  for url in ['https://example.invalid/a','http://qonqemhljgxlwpghkxhn.supabase.co/storage/v1/object/sign/ig-kyc-evidence/a','https://qonqemhljgxlwpghkxhn.supabase.co/storage/v1/object/public/ig-kyc-evidence/a','https://user@qonqemhljgxlwpghkxhn.supabase.co/storage/v1/object/sign/ig-kyc-evidence/a']:
   with patch.object(worker.OPENER,'open') as opener:
    with self.assertRaises(ValueError):worker.download({'url':url,'sha256':'0'*64})
    opener.assert_not_called()
 def test_hash_mismatch_is_rejected(self):
  with patch.object(worker.OPENER,'open') as opener:
   opener.return_value.__enter__.return_value.read.return_value=b'altered'
   with self.assertRaises(ValueError):worker.download({'url':worker.PROJECT+'/storage/v1/object/sign/ig-kyc-evidence/a','sha256':hashlib.sha256(b'original').hexdigest()})
 def test_failed_comparison_never_makes_a_review_decision(self):
  calls=[]
  def request(config,action,**payload):
   calls.append((action,payload))
   if action=='worker_expired':return {'result':[]}
   if action=='worker_claim':return {'job':{'id':'test','lease':'lease','images':{'id_front':{},'selfie':{}}}}
   return {}
  with patch.object(worker,'request_json',request),patch.object(worker,'download',return_value=b'fixture'),patch.object(worker,'compare',side_effect=ValueError('uncertain')):
   self.assertTrue(worker.cycle({},None))
  self.assertEqual(calls[-1],('worker_finish',{'id':'test','lease':'lease','result':{'status':'manual_review_required'}}))
if __name__=='__main__':unittest.main()