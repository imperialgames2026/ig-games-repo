import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';
import {createVipCatalog,vipProgress} from '@/lib/vipCatalog';
export const vipCatalog=createVipCatalog(supabase);
export function useVipCatalog(){
 return useQuery({queryKey:['vip-catalog'],queryFn:()=>vipCatalog.read(),staleTime:30000,refetchInterval:60000,retry:1});
}
export function useVipStatus(wallet){
 const catalog=useVipCatalog(),{user}=useAuth();
 const progress=!catalog.error&&wallet?.user_id===user?.id&&user?.id?vipProgress(wallet.experience_points,catalog.data?.levels):null;
 return {catalog,progress};
}
