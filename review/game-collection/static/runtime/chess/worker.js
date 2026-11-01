import {chooseMove} from './engine.js';
self.onmessage=({data})=>{try{self.postMessage({move:chooseMove(data.fen,data.depth)});}catch(e){self.postMessage({error:e.message});}};
