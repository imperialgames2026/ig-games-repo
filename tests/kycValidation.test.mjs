import test from 'node:test';
import assert from 'node:assert/strict';
import {imageInfo,normalizeFaceResult,validateInput} from '../supabase/functions/ig-kyc-v1/validation.js';
function png(w=200,h=200){const b=Buffer.alloc(64);b.set([137,80,78,71,13,10,26,10]);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b;}
test('image header validation bounds bytes, dimensions and image formats',()=>{
 assert.deepEqual(imageInfo(png()),{mime:'image/png',width:200,height:200,size:64});
 for(const bad of [png(1,1),png(6001,200),png(6000,6000),Buffer.from('<svg onload="evil"/>'),Buffer.alloc(9*1024*1024)])assert.throws(()=>imageInfo(bad));
});
test('user input cannot provide evidence paths, ownership, match scores or worker credentials',()=>{
 const id=crypto.randomUUID();for(const field of ['user_id','evidence','face_result','token_hash','status'])assert.throws(()=>validateInput({action:'submit',id,[field]:'injected'}));
 assert.throws(()=>validateInput({action:'upload',id,kind:'../../foreign'}));
 assert.throws(()=>validateInput({action:'anything'}));
});
test('comparison results are finite advisory measurements without templates or face landmarks',()=>{
 const result=normalizeFaceResult({status:'compared',cosine_similarity:0.6,id_image_sharpness:100,selfie_sharpness:120});
 assert.equal(result.display_similarity_index_0_to_100,80);assert.equal(result.score_calibrated,false);
 for(const cosine_similarity of [NaN,Infinity,1.01,-1.01])assert.throws(()=>normalizeFaceResult({status:'compared',cosine_similarity,id_image_sharpness:100,selfie_sharpness:120}));
 assert.throws(()=>normalizeFaceResult({...result,embedding:[0,1]}));
 assert.deepEqual(normalizeFaceResult({status:'manual_review_required'}),{status:'manual_review_required',model:'OpenCV YuNet + SFace',score_calibrated:false});
});
test('intake requires explicit consent and typed fields',()=>{
 const good={action:'begin',full_name:'Synthetic Test',birth_date:'1990-01-01',country:'US',document_type:'passport',consent:true,consent_version:'2026-10-22',face_consent:false};
 assert.deepEqual(validateInput(good),good);
 for(const patch of [{consent:false},{face_consent:'true'},{country:'ZZZ'},{document_type:'other'},{full_name:'<script>'},{birth_date:'yesterday'}])assert.throws(()=>validateInput({...good,...patch}));
});
