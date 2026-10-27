import {existsSync,realpathSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
export const projectRoot=realpathSync(existsSync(resolve(here,'../../package.json'))?resolve(here,'../..'):resolve(here,'../tournament-main-alignment'));
if(!existsSync(resolve(projectRoot,'supabase/backend-manifest.json'))||!existsSync(resolve(projectRoot,'pages/PlayPoker.jsx')))throw Error('Expected isolated main-site source missing');
