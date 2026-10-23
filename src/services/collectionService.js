import {supabase} from './api/supabaseClient';
async function rpc(name,args,missing) {
 const {data,error}=await supabase.rpc(name,args);
 if(error?.code==='PGRST202'&&missing!==undefined)return missing;
 if(error)throw new Error(error.message||'Collection settings unavailable. Please retry.');
 return data;
}
export const collectionService={
 options:vendorId=>vendorId?rpc('get_collection_options',{p_vendor_id:vendorId},{enabled:false,windows:[]}):Promise.resolve({enabled:false,windows:[]}),
 workspace:()=>rpc('admin_collection_workspace',{},null),
 configure:(change,revision,requestId,reason)=>rpc('admin_collection_config',{p_change:change,p_revision:revision,p_request_id:requestId,p_reason:reason}),
};
