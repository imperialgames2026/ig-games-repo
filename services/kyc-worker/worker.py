#!/usr/bin/env python3
"""Scoped private KYC worker. No customer names, images, URLs or tokens in logs."""
import argparse, hashlib, json, math, os, stat, time, urllib.request, urllib.parse
from pathlib import Path

PROJECT = 'https://qonqemhljgxlwpghkxhn.supabase.co'
MODEL_HASHES = {
 'face_detection_yunet_2023mar.onnx': '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
 'face_recognition_sface_2021dec.onnx': '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
}
MAX_BYTES = 8 * 1024 * 1024
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self, req, fp, code, msg, headers, newurl):
  raise ValueError('Redirect refused')
OPENER = urllib.request.build_opener(NoRedirect())

def read_json_private(path):
 p=Path(path)
 if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode) or stat.S_IMODE(p.stat().st_mode)&0o077:
  raise ValueError('Worker config must be a private regular file (mode 0600)')
 return json.loads(p.read_text())

def request_json(config, action, **payload):
 raw=json.dumps({'action':action,**payload}).encode()
 request=urllib.request.Request(PROJECT+'/functions/v1/ig-kyc-v1',data=raw,headers={
  'Content-Type':'application/json','Authorization':'Bearer '+config['anon_key'],
  'apikey':config['anon_key'],'x-kyc-worker-token':config['worker_token']})
 with OPENER.open(request,timeout=30) as response:
  data=response.read(1024*1024+1)
  if len(data)>1024*1024: raise ValueError('Oversized response')
  return json.loads(data)

def download(evidence):
 url=urllib.parse.urlsplit(evidence['url'])
 if url.scheme!='https' or url.netloc!='qonqemhljgxlwpghkxhn.supabase.co' or not url.path.startswith('/storage/v1/object/sign/ig-kyc-evidence/'):
  raise ValueError('Evidence URL outside private project')
 with OPENER.open(evidence['url'],timeout=30) as response:
  content=response.read(MAX_BYTES+1)
 if len(content)>MAX_BYTES or hashlib.sha256(content).hexdigest()!=evidence['sha256']:
  raise ValueError('Evidence integrity failure')
 return content

def load_models(directory):
 import cv2
 root=Path(directory)
 for name,expected in MODEL_HASHES.items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected: raise ValueError('Model checksum mismatch')
 detector=cv2.FaceDetectorYN.create(str(root/'face_detection_yunet_2023mar.onnx'),'',(320,320),0.8,0.3,5000)
 recognizer=cv2.FaceRecognizerSF.create(str(root/'face_recognition_sface_2021dec.onnx'),'')
 return detector,recognizer

def compare(images,models):
 import cv2
 import numpy as np
 detector,recognizer=models
 features=[];sharpness=[]
 for content in images:
  # Bytes have already passed server-side type, size and dimension checks.
  image=cv2.imdecode(np.frombuffer(content,dtype=np.uint8),cv2.IMREAD_COLOR)
  if image is None: raise ValueError('Unusable image')
  h,w=image.shape[:2]
  if min(h,w)<120 or max(h,w)>6000 or h*w>24000000: raise ValueError('Image dimensions outside bounds')
  detector.setInputSize((w,h));_,faces=detector.detect(image)
  if faces is None or len(faces)!=1 or min(faces[0][2:4])<60: raise ValueError('One clear face required')
  aligned=recognizer.alignCrop(image,faces[0]);features.append(recognizer.feature(aligned))
  sharpness.append(float(cv2.Laplacian(cv2.cvtColor(aligned,cv2.COLOR_BGR2GRAY),cv2.CV_64F).var()))
 score=float(recognizer.match(features[0],features[1],cv2.FaceRecognizerSF_FR_COSINE))
 if not math.isfinite(score) or not all(math.isfinite(x) for x in sharpness):raise ValueError('Invalid model measurement')
 return {'status':'compared','cosine_similarity':max(-1,min(1,round(score,5))),'id_image_sharpness':round(sharpness[0],1),'selfie_sharpness':round(sharpness[1],1)}

def cycle(config,models):
 # Deletion runs independently of comparison availability. No disk evidence cache.
 for item in request_json(config,'worker_expired')['result']:
  request_json(config,'worker_purged',id=item['id'])
 job=request_json(config,'worker_claim')['job']
 if not job:return False
 try:
  images=[download(job['images'][kind]) for kind in ('id_front','selfie')]
  result=compare(images,models)
 except Exception:
  result={'status':'manual_review_required'}
 finally:
  # No files or biometric templates are persisted by this process.
  images=None
 request_json(config,'worker_finish',id=job['id'],lease=job['lease'],result=result)
 return True

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--config',required=True);parser.add_argument('--models',required=True);parser.add_argument('--once',action='store_true');parser.add_argument('--check-models',action='store_true');args=parser.parse_args()
 models=load_models(args.models)
 if args.check_models: print('Pinned face models loaded successfully');return
 config=read_json_private(args.config)
 while True:
  try:
   completed=cycle(config,models)
   print('KYC worker cycle complete'+(' (comparison processed)' if completed else ''),flush=True)
  except Exception:
   print('KYC worker cycle failed; no sensitive details logged',flush=True)
   if args.once:raise SystemExit(1)
  if args.once:return
  time.sleep(60)
if __name__=='__main__': main()