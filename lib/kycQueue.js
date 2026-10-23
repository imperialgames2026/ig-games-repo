// Mixed-version rollout: old UI requests keep the legacy array contract; a new
// UI can explicitly report the old service's bounded queue without pretending
// that client filtering has searched the complete history.
export async function loadReviewQueue(api,query){
 let result;
 try{result=await api.action('queue',query);}
 catch(error){if(error.status!==400)throw error;result=await api.action('queue');}
 if(Array.isArray(result)){
  const status=query.status??'pending';
  const rows=result.filter(r=>status==='all'||(status==='pending'?['submitted','escalated'].includes(r.status):r.status===status));
  return {rows,next_cursor:null,limited:true};
 }
 if(!result||!Array.isArray(result.rows))throw Error('Queue unavailable');
 return {...result,limited:false};
}
