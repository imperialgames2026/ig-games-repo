export const GAMES={
 "mystic-forest":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "diamond-dynasty":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "sapphire-storm":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "emerald-empire":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "phoenix-fire":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "aztec-treasure":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "ocean-treasure":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "farmageddon":{symbols:8,wild:7,scatter:6,cols:4,rows:4,maxLines:6},
 "neon-nights":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "cosmic-crown":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "golden-dragon":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
 "lucky-fortune":{symbols:8,wild:6,scatter:7,cols:5,rows:3,maxLines:20},
 "royal-ruby":{symbols:9,wild:7,scatter:8,cols:5,rows:3,maxLines:20},
};
const LINES_5X3=[
 [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
 [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
 [2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],[1,0,1,0,1],[1,2,1,2,1],
 [0,0,0,1,2],[2,2,2,1,0],[0,1,2,2,2],[2,1,0,0,0],[1,1,0,1,1]
];
const LINES_4X4=[[0,0,0,0],[1,1,1,1],[2,2,2,2],[3,3,3,3],[0,1,2,3],[3,2,1,0]];
function baseMultiplier(symbol,count,wild){
 if(symbol===wild)return count>=5?120:count===4?50:20;
 const base=Math.max(2,20-symbol*2);
 return count>=5?base*5:count===4?base*2:base;
}
export function validateSpinInput(game,bet,lines){
 const cfg=GAMES[game];
 return !!cfg&&Number.isSafeInteger(bet)&&bet>=1&&bet<=100&&Number.isSafeInteger(lines)&&lines>=1&&lines<=cfg.maxLines;
}
export function evaluateGrid(game,bet,lines,grid){
 const cfg=GAMES[game];
 if(!validateSpinInput(game,bet,lines)||!Array.isArray(grid)||grid.length!==cfg.cols||
    grid.some(col=>!Array.isArray(col)||col.length!==cfg.rows||col.some(v=>!Number.isSafeInteger(v)||v<0||v>=cfg.symbols)))throw Error("Invalid slot grid");
 const active=(cfg.cols===4?LINES_4X4:LINES_5X3).slice(0,lines);
 const winning=new Set();let paid=0;
 for(const line of active){
  const cells=line.map((row,col)=>grid[col][row]);
  let base=cells.find(s=>s!==cfg.wild);
  if(base===undefined)base=cfg.wild;
  if(base===cfg.scatter)continue;
  let count=0;
  for(let col=0;col<cells.length;col++){
   const symbol=cells[col];
   if(symbol===cfg.scatter)break;
   if(symbol===base||symbol===cfg.wild)count++;else break;
  }
  if(count>=3){
   paid+=bet*baseMultiplier(base,count,cfg.wild);
   for(let col=0;col<count;col++)winning.add(`${col},${line[col]}`);
  }
 }
 let scatterCount=0;
 for(let col=0;col<cfg.cols;col++)for(let row=0;row<cfg.rows;row++)if(grid[col][row]===cfg.scatter){scatterCount++;winning.add(`${col},${row}`);}
 const totalCost=bet*lines;
 if(scatterCount>=3)paid+=totalCost*(scatterCount>=5?50:scatterCount===4?10:2);
 return {winningCells:[...winning],scatterCount,paidUnits:Math.min(100000000,Math.floor(paid))};
}
export function generateGrid(game,randomInt){
 const cfg=GAMES[game];if(!cfg)throw Error("Unsupported slot");
 return Array.from({length:cfg.cols},()=>Array.from({length:cfg.rows},()=>randomInt(cfg.symbols)));
}
