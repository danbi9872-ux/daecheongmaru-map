import companies from './companies.json';
const cache=new Map();
const endpoint='https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const normalize = value => String(value || '').toLowerCase()
  .replace(/주식회사|유한회사|유한책임회사|\(주\)|㈜/g, '')
  .replace(/[\s.,()·\-]/g, '');
const address = value => String(value || '').toLowerCase()
  .replace(/경상북도|경북도/g,'경북').replace(/대구광역시|대구시/g,'대구')
  .replace(/\([^)]*\)/g,'').replace(/[^가-힣a-z0-9]/g,'');
const addressMatches = (a,b,region) => {
  const left=address(a),right=address(b);
  if(left.length<12 || right.length<12 || !/\d/.test(left) || !/\d/.test(right)) return false;
  const placeNumber = value => String(value||'').match(/(?:로|길|동|리)\s*(\d+(?:-\d+)?)/)?.[1]||'';
  const aNumber=placeNumber(a),bNumber=placeNumber(b);
  if(!aNumber || !bNumber || aNumber!==bNumber) return false;
  if(/^(대구|경북|서울|부산|인천)/.test(left) && /^(대구|경북|서울|부산|인천)/.test(right) && left.slice(0,2)!==right.slice(0,2)) return false;
  if(left===right || (left.length>=14 && right.startsWith(left)) || (right.length>=14 && left.startsWith(right))) return true;
  // The source data sometimes omits the metropolitan prefix. Require a full county-to-number match.
  const token=address(region),li=left.indexOf(token),ri=right.indexOf(token);
  const l=li>=0?left.slice(li):'',r=ri>=0?right.slice(ri):'';
  return !!(l && r && l.length>=14 && r.length>=14 && (l===r || l.startsWith(r) || r.startsWith(l)));
};
const entity = value => String(value || '').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&amp;/g,'&');
const field = (xml,tag) => entity((xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))||[])[1]||'').trim();
const respond=(statusCode,body)=>new Response(JSON.stringify(body),{status:statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'}});

export async function onRequestGet({request,env}) {
  const id=new URL(request.url).searchParams.get('id')||'';
  let company=companies.find(x=>x.id===id);
  try {
    const res=await fetch('https://mjaoqljgqxrwmeyvwtow.supabase.co/rest/v1/map_companies?id=eq.'+encodeURIComponent(id)+'&select=data',{headers:{apikey:'sb_publishable_VFVncLC2jEgBhYH_s6Z-Ug_qM_-rKyF'}});
    if(res.ok){const row=(await res.json())[0]?.data;if(row)company={...company,...row};}
  }catch(e){console.warn('Company override unavailable',e);}
  if(!company)return respond(400,{error:'기업을 찾을 수 없습니다.'});
  const key=env.WORK24_API_KEY;
  if(!key)return respond(503,{error:'채용정보 연결 준비 중입니다.'});
  const previous=cache.get(id);
  if(previous&&Date.now()-previous.time<10*60*1000)return respond(200,previous.value);
  const sameNames = companies.filter(x=>normalize(x.name)===normalize(company.name));
  if (sameNames.some(x=>x.id!==id && address(x.address)===address(company.address)))
    return respond(200,{status:'ambiguous',message:'동일한 기업명과 주소의 등록 사업장이 있어 자동 매칭하지 않았습니다.',jobs:[]});
  const term = company.name.replace(/^(주식회사|유한회사|유한책임회사)\s*/, '').replace(/\s*주식회사$/, '').trim();
  const url = new URL(endpoint);
  Object.entries({authKey:key,callTp:'L',returnType:'XML',startPage:'1',display:'100',keyword:term}).forEach(([k,v])=>url.searchParams.set(k,v));
  try {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),8000);
    let response;
    try { response=await fetch(url,{signal:controller.signal}); } finally { clearTimeout(timer); }
    if (!response.ok) throw new Error('Upstream HTTP '+response.status);
    const xml=await response.text();
    if (xml.length>2_000_000) throw new Error('Oversized response');
    if (!/<wantedRoot[\s>]/.test(xml)) throw new Error('Unexpected response');
    const total=Number(field(xml,'total'))||0;
    // A truncated keyword search cannot establish the absence of matching jobs.
    if (total>100) return respond(200,{status:'ambiguous',message:'검색 결과가 많아 자동 확인이 어렵습니다. 고용24 원문에서 확인해 주세요.',jobs:[]});
    const rows=[...xml.matchAll(/<wanted(?:\s[^>]*)?>([\s\S]*?)<\/wanted>/g)];
    const jobs=rows.map(([,row])=>({
      wantedAuthNo:field(row,'wantedAuthNo'),company:field(row,'company'),title:field(row,'title'),
      region:field(row,'region'),closeDt:field(row,'closeDt'),address:field(row,'basicAddr'),
      infoSvc:field(row,'infoSvc')
    })).filter(j=>j.wantedAuthNo && j.infoSvc==='VALIDATION' && (normalize(j.company)===normalize(company.name) && addressMatches(company.address,j.address,company.region)))
      .filter(j=>!/^\d{8}$/.test(j.closeDt) || j.closeDt>=new Date().toISOString().slice(0,10).replace(/-/g,''))
      .slice(0,20).map(j=>({title:j.title,region:j.region,closeDt:j.closeDt,
        url:`https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=${encodeURIComponent(j.wantedAuthNo)}&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet`}));
    const value={status:'verified-address',jobs,checkedAt:new Date().toISOString(),message:'기업명과 근무지 주소가 일치하는 공고입니다. 최종 근무 사업장은 고용24 원문에서 확인해 주세요.'};
    cache.set(id,{time:Date.now(),value});
    return respond(200,value);
  } catch(e) {
    console.error('Work24 request failed:',e.message);
    return respond(502,{status:'unavailable',error:'현재 채용정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
  }
};
