import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 const manifest=JSON.parse(readFileSync(new URL('./supabase/backend-manifest.json',import.meta.url),'utf8'));
 const scope=JSON.parse(readFileSync(new URL('./config/game-migration-scope.json',import.meta.url),'utf8'));
 const release={name:'imperial-games-release',apply:'build',generateBundle(){
  const commit=env.CF_PAGES_COMMIT_SHA||env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!/^[0-9a-f]{40}$/.test(commit))throw Error('Release commit could not be identified.');
  if(env.VITE_ENABLE_LEGACY_EDGE_FUNCTIONS==='true')throw Error('Unreviewed legacy operations cannot be published.');
  this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({commit,built_at:new Date().toISOString(),release_mode:'practice',backend_url:env.VITE_SUPABASE_URL,legacy_operations_enabled:false,reviewed_migration_count:manifest.migrations.length,held_game_count:scope.nonMigration.length})+'\n'});
 }};
 return {
  logLevel: 'error',
  plugins: [react(),release],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
};
})
