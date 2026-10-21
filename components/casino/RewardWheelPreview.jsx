import React from 'react';
export default function RewardWheelPreview({segments,stage,rotation=0}){
 const palettes={1:['#047857','#10b981'],2:['#b45309','#f59e0b'],3:['#6d28d9','#a78bfa']};
 const point=angle=>[120+105*Math.cos(angle),120+105*Math.sin(angle)];
 return <div className="relative mx-auto w-60 max-w-full"><span aria-hidden="true" className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-3xl text-amber-200">▼</span><svg viewBox="0 0 240 240" role="img" aria-label={'Stage '+stage+' wheel section preview'} className="w-full">
  <g style={{transform:`rotate(${rotation}deg)`,transformOrigin:'120px 120px'}} className="transition-transform [transition-duration:2200ms] ease-out motion-reduce:transition-none">
   {segments.map((row,i)=>{const start=i*2*Math.PI/segments.length-Math.PI/2,end=(i+1)*2*Math.PI/segments.length-Math.PI/2,a=point(start),b=point(end),middle=(start+end)/2;return <g key={row.slot}><path d={`M120 120 L${a[0]} ${a[1]} A105 105 0 0 1 ${b[0]} ${b[1]} Z`} fill={Number(row.weight)===0?'#374151':palettes[stage][i%2]} stroke="#14121e" strokeWidth="2"><title>{`Section ${row.slot}: ${row.reward}, ${row.amount} ${row.unit}`}</title></path><text x={120+80*Math.cos(middle)} y={125+80*Math.sin(middle)} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{row.slot}</text></g>;})}
  </g><circle cx="120" cy="120" r="43" fill="#11121d" stroke="#ffffff33" strokeWidth="2"/><text x="120" y="117" textAnchor="middle" fill="white" fontSize="12">STAGE</text><text x="120" y="141" textAnchor="middle" fill="#fde68a" fontSize="23" fontWeight="bold">{stage}</text>
 </svg></div>;
}
