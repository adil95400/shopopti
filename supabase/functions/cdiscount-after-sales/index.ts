import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { decryptSecretPayload } from "../_shared/secretEnvelope.ts";

const API_BASE = "https://api.octopia-io.net/seller/v2";
const TOKEN_URL = "https://auth.octopia-io.net/auth/realms/maas/protocol/openid-connect/token";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

type Action =
  | "cancellation_reasons" | "list_cancellations"
  | "cancel_order" | "cancel_order_lines"
  | "gesture_available_amount" | "list_gestures" | "create_gesture";

type CancelLine = {
  lineId?: string; offerId?: string; reason?: string; shippingCostRefund?: boolean;
};

type RequestBody = {
  action?: Action; orderId?: string; orderStatus?: string; salesChannel?: string;
  cancellationRequestId?: string; lineId?: string; offerId?: string;
  reason?: string; shippingCostRefund?: boolean; lines?: CancelLine[];
  pageIndex?: number; pageSize?: number; cursor?: string; limit?: number;
  status?: string; createdAtMin?: string; createdAtMax?: string;
  updatedAtMin?: string; updatedAtMax?: string; reasonDetails?: string;
  amount?: number; idempotencyKey?: string;
};

type SecretEnvelope = { v: number; alg: "AES-GCM"; iv: string; ciphertext: string };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function readKeySet(name: string) {
  const raw = Deno.env.get(name); if (!raw) return "";
  try { const p = JSON.parse(raw) as Record<string,string>; return p.default || Object.values(p)[0] || ""; }
  catch { return raw; }
}
function publishableKey() { return Deno.env.get("SUPABASE_ANON_KEY") || readKeySet("SUPABASE_PUBLISHABLE_KEYS"); }
function serverKey() { return readKeySet("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "", key = serverKey();
  if (!url || !key) throw new Error("Supabase server configuration unavailable");
  return createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
}
async function user(req: Request) {
  const authorization=req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const url=Deno.env.get("SUPABASE_URL")||"", key=publishableKey();
  if (!url || !key) return null;
  const c=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await c.auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}
async function credentials(userId:string) {
  const key=Deno.env.get("CDISCOUNT_CREDENTIALS_ENCRYPTION_KEY")||"";
  if(!key) throw new Error("Secure Cdiscount credentials are not configured");
  const {data,error}=await admin().from("integrations")
    .select("encrypted_credentials,seller_id,connection_status,is_active")
    .eq("user_id",userId).eq("platform_type","cdiscount").maybeSingle();
  if(error || !data || !data.is_active || data.connection_status!=="connected") throw new Error("Cdiscount is not connected");
  const creds=await decryptSecretPayload(data.encrypted_credentials as SecretEnvelope,key);
  const clientId=creds.clientId?.trim(), clientSecret=creds.clientSecret?.trim(), sellerId=(creds.sellerId||data.seller_id||"").trim();
  if(!clientId||!clientSecret||!sellerId) throw new Error("Cdiscount credentials are incomplete");
  return {clientId,clientSecret,sellerId};
}
async function token(clientId:string,clientSecret:string) {
  const form=new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"client_credentials"});
  const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const b=await r.json().catch(()=>({})) as Record<string,unknown>;
  if(!r.ok || typeof b.access_token!=="string") throw new Error(r.status===401?"Octopia rejected the stored credentials":"Octopia token request failed");
  return b.access_token;
}
function headers(t:string,sellerId:string, extra:Record<string,string>={}) {
  return {Authorization:`Bearer ${t}`,SellerId:sellerId,Accept:"application/json",...extra};
}
async function parsed(r:Response) {
  const b=await r.json().catch(()=>null);
  if(!r.ok) {
    if(r.status===401||r.status===403) throw new Error("Octopia denied access to this seller");
    if(r.status===429) throw new Error("Octopia rate limit reached");
    const detail=b&&typeof b==="object"&&"detail" in b?String((b as Record<string,unknown>).detail):null;
    throw new Error(detail||`Octopia request failed (${r.status})`);
  }
  return b;
}
async function hash(v:unknown) {
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(v)));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function reserve(userId:string,action:string,key:string,fingerprint:string) {
  const a=admin();
  const {data,error}=await a.from("publication_logs").insert({
    user_id:userId,channel_type:"marketplace",channel_id:"cdiscount",channel_name:"Cdiscount / Octopia",
    action,status:"in_progress",idempotency_key:key,metadata:{request_fingerprint:fingerprint}
  }).select("id,status,external_id,metadata").single();
  if(!error) return {a,log:data,replayed:false};
  if(error.code!=="23505") throw new Error("Cdiscount idempotency ledger reservation failed");
  const {data:old,error:e}=await a.from("publication_logs").select("id,status,external_id,metadata")
    .eq("user_id",userId).eq("channel_id","cdiscount").eq("action",action).eq("idempotency_key",key).maybeSingle();
  if(e||!old) throw new Error("Cdiscount idempotency ledger lookup failed");
  if(old.metadata?.request_fingerprint && old.metadata.request_fingerprint!==fingerprint) throw new Error("Idempotency key was already used with a different payload");
  return {a,log:old,replayed:true};
}
async function complete(a:ReturnType<typeof admin>,id:string,externalId:string|null,metadata:Record<string,unknown>) {
  const {error}=await a.from("publication_logs").update({status:"success",external_id:externalId,error_message:null,metadata}).eq("id",id);
  if(error) throw new Error("Cdiscount idempotency ledger completion failed");
}
async function ambiguous(a:ReturnType<typeof admin>,id:string,message:string) {
  await a.from("publication_logs").update({status:"ambiguous",error_message:message}).eq("id",id);
}
function add(q:URLSearchParams,k:string,v?:string){if(v?.trim())q.set(k,v.trim());}

serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  if(req.method!=="POST") return json({success:false,error:"Method not allowed"},405);
  try {
    const u=await user(req); if(!u) return json({success:false,error:"Authentication required"},401);
    const input=await req.json() as RequestBody; if(!input.action) return json({success:false,error:"action is required"},400);
    const c=await credentials(u.id), t=await token(c.clientId,c.clientSecret);
    const action=input.action;

    if(action==="cancellation_reasons") {
      if(!input.orderStatus) return json({success:false,error:"orderStatus is required"},400);
      const q=new URLSearchParams({userType:"Seller",orderStatus:input.orderStatus});
      add(q,"salesChannel",input.salesChannel||"CDISFR");
      const r=await fetch(`${API_BASE}/cancellation-reasons?${q}`,{headers:headers(t,c.sellerId)});
      return json({success:true,action,data:await parsed(r)});
    }
    if(action==="list_cancellations") {
      if(!input.orderId && !input.cancellationRequestId) return json({success:false,error:"orderId or cancellationRequestId is required"},400);
      const q=new URLSearchParams({pageIndex:String(Math.max(1,input.pageIndex||1)),pageSize:String(Math.max(1,Math.min(input.pageSize||50,100)))});
      add(q,"orderSellerId",input.orderId); add(q,"cancellationRequestId",input.cancellationRequestId);
      add(q,"lineId",input.lineId); add(q,"offerId",input.offerId); add(q,"salesChannel",input.salesChannel);
      const r=await fetch(`${API_BASE}/order-cancellation-requests?${q}`,{headers:headers(t,c.sellerId)});
      return json({success:true,action,data:await parsed(r),link:r.headers.get("Link")});
    }
    if(action==="gesture_available_amount") {
      if(!input.orderId) return json({success:false,error:"orderId is required"},400);
      const r=await fetch(`${API_BASE}/orders/${encodeURIComponent(input.orderId)}/commercial-gestures-available-amounts`,{headers:headers(t,c.sellerId)});
      return json({success:true,action,orderId:input.orderId,data:await parsed(r)});
    }
    if(action==="list_gestures") {
      const q=new URLSearchParams({limit:String(Math.max(1,Math.min(input.limit||100,1000)))});
      add(q,"cursor",input.cursor); add(q,"orderId",input.orderId); add(q,"status",input.status);
      add(q,"createdAtMin",input.createdAtMin); add(q,"createdAtMax",input.createdAtMax);
      add(q,"updatedAtMin",input.updatedAtMin); add(q,"updatedAtMax",input.updatedAtMax);
      const r=await fetch(`${API_BASE}/order-commercial-gesture-requests?${q}`,{headers:headers(t,c.sellerId)});
      return json({success:true,action,data:await parsed(r),link:r.headers.get("Link")});
    }

    const key=input.idempotencyKey?.trim();
    if(!key) return json({success:false,error:"idempotencyKey is required for mutations"},400);
    let path="", payload:Record<string,unknown>={};

    if(action==="cancel_order") {
      if(!input.orderId||!input.reason) return json({success:false,error:"orderId and reason are required"},400);
      path="order-cancellation-requests";
      payload={orderSellerId:input.orderId,reason:input.reason,shippingCostRefund:input.shippingCostRefund!==false};
    } else if(action==="cancel_order_lines") {
      if(!input.orderId||!input.lines?.length) return json({success:false,error:"orderId and lines are required"},400);
      for(const line of input.lines) if(!line.lineId||!line.offerId||!line.reason) return json({success:false,error:"lineId, offerId and reason are required for every line"},400);
      path="order-partial-cancellation-requests";
      payload={orderSellerId:input.orderId,lines:input.lines.map(x=>({lineId:x.lineId,offerId:x.offerId,reason:x.reason,shippingCostRefund:x.shippingCostRefund!==false}))};
    } else if(action==="create_gesture") {
      if(!input.orderId||!input.reason||typeof input.amount!=="number"||!Number.isFinite(input.amount)||input.amount<=0) return json({success:false,error:"orderId, reason and a positive amount are required"},400);
      if(input.reason==="Other"&&!input.reasonDetails?.trim()) return json({success:false,error:"reasonDetails is required when reason is Other"},400);
      const order=await fetch(`${API_BASE}/orders/${encodeURIComponent(input.orderId)}`,{headers:headers(t,c.sellerId)});
      const orderData=await parsed(order) as Record<string,unknown>;
      if(!["Shipped","Delivered"].includes(String(orderData.status))) return json({success:false,error:"Commercial gestures require a Shipped or Delivered order",orderStatus:orderData.status??null},409);
      const amountResponse=await fetch(`${API_BASE}/orders/${encodeURIComponent(input.orderId)}/commercial-gestures-available-amounts`,{headers:headers(t,c.sellerId)});
      const amountData=await parsed(amountResponse) as Record<string,unknown>;
      const allowable=Number(amountData.allowableAmount);
      if(!Number.isFinite(allowable)||input.amount>allowable) return json({success:false,error:"Commercial gesture amount exceeds Octopia allowable amount",allowableAmount:Number.isFinite(allowable)?allowable:null},409);
      path="order-commercial-gesture-requests";
      payload={orderId:input.orderId,reason:input.reason,reasonDetails:input.reasonDetails,amount:input.amount};
    } else return json({success:false,error:"Unsupported action"},400);

    const fingerprint=await hash({action,payload});
    const res=await reserve(u.id,action,key,fingerprint);
    if(res.replayed) {
      if(res.log.status==="success") return json({success:true,replayed:true,action,externalId:res.log.external_id,data:res.log.metadata});
      return json({success:false,error:"This Cdiscount after-sales operation is already in progress or has an ambiguous outcome",status:res.log.status},409);
    }

    let remote:Response;
    try {
      remote=await fetch(`${API_BASE}/${path}`,{method:"POST",headers:headers(t,c.sellerId,{"Content-Type":"application/json"}),body:JSON.stringify(payload)});
    } catch(e) {
      const m=e instanceof Error?e.message:"Remote request failed"; await ambiguous(res.a,res.log.id,m);
      throw new Error("Cdiscount after-sales outcome is ambiguous; manual reconciliation required");
    }
    let data:unknown;
    try { data=await parsed(remote); }
    catch(e) { const m=e instanceof Error?e.message:"Remote request failed"; await ambiguous(res.a,res.log.id,m); throw e; }

    const obj=(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as Record<string,unknown>;
    const externalId=String(obj.requestId||obj.cancellationRequestId||obj.partialCancellationRequestId||input.orderId||"");
    await complete(res.a,res.log.id,externalId||null,{request_fingerprint:fingerprint,path,remote:data});
    return json({success:true,action,data},201);
  } catch(e) {
    return json({success:false,error:e instanceof Error?e.message:"Cdiscount after-sales request failed"},400);
  }
});
