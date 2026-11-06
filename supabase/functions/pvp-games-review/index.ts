import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createPvpHandler} from './handler.mjs';
Deno.serve(createPvpHandler({env:key=>Deno.env.get(key),createClient}));
