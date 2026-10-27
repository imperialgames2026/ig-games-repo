"""Offline SQL source assembly only: never connects or starts anything."""
import hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
def checked(item):
 p=ROOT/item['path'];raw=p.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=item['sha256']:raise ValueError('source drift: '+item['path'])
 return raw.decode()
def build():
 here=ROOT/'review/real-auth-practice';m=json.loads((here/'dependency-closure.json').read_text())
 archive=m['archiveExtraction'];raw=(ROOT/archive['source']).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=archive['sourceSha256']:raise ValueError('archive source drift')
 archive_sql=checked({'path':archive['output'],'sha256':archive['outputSha256']})
 expected='-- REVIEW ONLY: exact archive DDL prefix; excludes unrelated coaching receipt ALTER.\n'+raw.decode().split(archive['stopBefore'])[0]
 if archive_sql!=expected:raise ValueError('archive extraction drift')
 parts=['-- REVIEW ONLY. Real Auth prerequisites; no runtime/deployment authorization.\nbegin;', (here/'app-schema.sql').read_text()]
 for f in m['selectedGameSources']:
  text=checked(f);text=re.sub(r'^select cron.schedule\(.*$','-- Practice lab: scheduled cron disabled.',text,flags=re.M)
  parts+=['-- SOURCE '+f['path']+' SHA256 '+f['sha256'],text]
 parts+=[archive_sql]
 for f in m['additionalSourceDependencies']:parts+=['-- SOURCE '+f['path']+' SHA256 '+f['sha256'],checked(f)]
 parts+=[(here/'after-game-schema.sql').read_text()]
 for f in m['proposalSources']:parts+=['-- UNAPPLIED PROPOSAL '+f['path']+' SHA256 '+f['sha256'],checked(f)]
 parts+=['commit;'];return '\n'.join(parts)+'\n'
if __name__=='__main__':
 # Output is a source artifact only, not a migration execution.
 output=ROOT.parent/'real-auth-practice-staged-review.sql';output.write_text(build());print(json.dumps({'status':'SOURCE_ONLY_NOT_EXECUTED','path':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
