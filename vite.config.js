import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { collectionReviewEnabled } from './lib/collectionReviewMode.mjs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 const manifest=JSON.parse(readFileSync(new URL('./supabase/backend-manifest.json',import.meta.url),'utf8'));
 const scope=JSON.parse(readFileSync(new URL('./config/game-migration-scope.json',import.meta.url),'utf8'));
 const includeCollection=collectionReviewEnabled({mode,cfBranch:env.CF_PAGES_BRANCH,vercelBranch:env.VERCEL_GIT_COMMIT_REF});
 const collection={name:'isolated-game-collection-review',apply:'build',generateBundle(){
  if(!includeCollection)return;
  const root=fileURLToPath(new URL('./review/game-collection/static',import.meta.url));
  const walk=dir=>{for(const name of readdirSync(dir).sort()){const path=resolve(dir,name),info=lstatSync(path);if(info.isSymbolicLink())throw Error('Review assets must not be symlinks');if(info.isDirectory())walk(path);else{if(info.size>25*1024*1024)throw Error('Review asset exceeds existing Pages size limit');this.emitFile({type:'asset',fileName:'game-collection/'+relative(root,path).replaceAll('\\','/'),source:readFileSync(path)});}}};walk(root);
  this.emitFile({type:'asset',fileName:'_headers',source:'/game-collection/*\n  Cache-Control: no-store\n'});
 }};
 const release={name:'imperial-games-release',apply:'build',generateBundle(){
  const commit=env.CF_PAGES_COMMIT_SHA||env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!/^[0-9a-f]{40}$/.test(commit))throw Error('Release commit could not be identified.');
  if(env.VITE_ENABLE_LEGACY_EDGE_FUNCTIONS==='true')throw Error('Unreviewed legacy operations cannot be published.');
  this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({commit,built_at:new Date().toISOString(),release_mode:'practice',backend_url:env.VITE_SUPABASE_URL,legacy_operations_enabled:false,reviewed_migration_count:manifest.migrations.length,held_game_count:scope.nonMigration.length})+'\n'});
 }};
 return {
  logLevel: 'error',
  define:{__IG_GAME_COLLECTION_REVIEW__:JSON.stringify(includeCollection)},
  build: {rollupOptions:{input:{index:fileURLToPath(new URL('./index.html',import.meta.url)),practice:fileURLToPath(new URL('./practice-lab.html',import.meta.url)),unity:fileURLToPath(new URL('./unity-practice-frame.html',import.meta.url))}}},
  plugins: [react(),release,collection],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
};
})
