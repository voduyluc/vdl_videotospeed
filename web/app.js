const $ = s => document.querySelector(s);
let selected = null, current = null, dirty = false, page = 0, busy = false;
const drafts = new Map();
let previewAudio = null, previewUrl = null, previewButton = null, previewRequest = 0;
function stopPreview(){
  previewRequest++;
  if(previewAudio){previewAudio.pause();previewAudio=null;}
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  if(previewButton){previewButton.textContent='Nghe thử';previewButton=null;}
}
async function playSnippet(segment,button){
  if(previewButton===button){stopPreview();return;}
  stopPreview();
  if((drafts.get(segment.id)??segment.translation)!==segment.translation || ($('#voice')&&$('#voice').value!==current.voice)){
    toast('Bản dịch hoặc giọng chưa lưu. Hãy lưu và tạo lại audio trước khi nghe thử.');return;
  }
  const request=previewRequest;
  button.disabled=true;
  try{
    const r=await fetch(`/api/projects/${selected}/segments/${encodeURIComponent(segment.id)}/audio`,{cache:'no-store'});
    if(!r.ok){const error=await r.json().catch(()=>({detail:'Không thể tải audio.'}));throw Error(error.detail);}
    const blob=await r.blob();
    if(request!==previewRequest)return;
    document.querySelectorAll('video,audio').forEach(media=>media.pause());
    previewUrl=URL.createObjectURL(blob);previewAudio=new Audio(previewUrl);previewButton=button;
    button.textContent='Dừng';previewAudio.onended=stopPreview;
    await previewAudio.play();
  }catch(e){if(request===previewRequest){stopPreview();toast(e.message);}}
  finally{button.disabled=false;}
}
const labels = {queued:'Đang chờ',running:'Đang xử lý',review:'Chờ duyệt',failed:'Cần kiểm tra',completed:'Hoàn tất',cancelled:'Đã hủy'};
function el(tag, text, cls) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(cls)e.className=cls; return e; }
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; setTimeout(()=>$('#toast').style.display='none',6000); }
async function api(path,options={}) { const r=await fetch('/api'+path,options); if(!r.ok){let b=await r.json().catch(()=>({detail:r.statusText}));throw Error(typeof b.detail==='string'?b.detail:JSON.stringify(b.detail));} return r.json(); }
async function act(action) { try {if(action==='generate'){await save();} await api(`/projects/${selected}/${action}`,{method:'POST'}); dirty=false; await refresh(true);}catch(e){toast(e.message);} }
async function save(){
  if(!current)return;
  for(const s of current.segments){if(drafts.has(s.id))s.translation=drafts.get(s.id);}
  await api(`/projects/${selected}/segments`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments:current.segments,voice:$('#voice').value})});
  dirty=false;drafts.clear();
}
function time(s){return new Date(s*1000).toISOString().slice(11,19);}
function renderSegments(container, editable, warnings){
  stopPreview();
  container.replaceChildren();
  const segments=current.segments;
  for(const s of segments.slice(page*40,(page+1)*40)){
    const row=el('div',undefined,'segment'+(warnings.has(s.id)?' warning':''));
    const actions=el('div');
    const t=el('button',`${time(s.start)} → ${time(s.end)}`,'time secondary');t.onclick=()=>{stopPreview();$('video').currentTime=s.start;};actions.append(t);
    const listen=el('button','Nghe thử','secondary');listen.style.marginTop='8px';listen.setAttribute('aria-label',`Nghe audio tiếng Việt ${s.id}`);listen.onclick=()=>playSnippet(s,listen);actions.append(listen);row.append(actions);
    row.append(el('div',s.source,'source'));
    const area=el('textarea');area.value=drafts.get(s.id)??s.translation;area.disabled=!editable;area.setAttribute('aria-label',`Bản dịch ${s.id}`);
    area.oninput=()=>{stopPreview();drafts.set(s.id,area.value);dirty=true;};row.append(area);
    if(warnings.has(s.id)){area.title='Câu vượt khoảng thời gian cho phép. Hãy rút gọn bản dịch.';}
    container.append(row);
  }
}
function render(){
  stopPreview();
  const w=$('#workspace');w.replaceChildren(); const p=current;
  const heading=el('div',undefined,'heading');heading.append(el('h2',p.name),el('span',labels[p.state]||p.state,'status'));w.append(heading);
  w.append(el('p',`${p.progress} · ${p.segments.length} đoạn · ${time(p.duration)}`));
  const video=el('video');video.controls=true;video.preload='metadata';video.src=`/api/projects/${p.id}/files/source`;w.append(video);
  if(p.error)w.append(el('pre',p.error,'error'));
  const tools=el('div',undefined,'toolbar');
  const editable=['review','failed','completed'].includes(p.state);
  if(editable&&p.segments.length){
    tools.append(el('label','Giọng đọc: '));const voice=el('input');voice.type='text';voice.id='voice';voice.value=p.voice;voice.oninput=()=>{stopPreview();dirty=true;};tools.append(voice);
    const saveButton=el('button','Lưu bản dịch','secondary');saveButton.onclick=async()=>{try{await save();toast('Đã lưu');await refresh(true);}catch(e){toast(e.message);}};tools.append(saveButton);
    const generate=el('button','Lưu & tạo audio');generate.onclick=()=>act('generate');tools.append(generate);
  }
  if(['running','queued'].includes(p.state)){const b=el('button','Hủy xử lý','secondary');b.onclick=()=>act('cancel');tools.append(b);}
  if(['failed','cancelled'].includes(p.state)){const b=el('button','Thử lại bước hiện tại','secondary');b.onclick=()=>act('resume');tools.append(b);}
  w.append(tools);
  if(p.exports.includes('narration.mp3')){const audio=el('audio');audio.controls=true;audio.src=`/api/projects/${p.id}/files/narration.mp3`;w.append(audio);}
  const downloads=el('div',undefined,'downloads');for(const name of p.exports){const a=el('a',name,'download');a.href=`/api/projects/${p.id}/files/${name}`;a.download=name;downloads.append(a);}w.append(downloads);
  if(p.segments.length){
    w.append(el('p','Nhấn mốc thời gian để nghe lời gốc. Viền cam: câu cần rút gọn. Giọng đọc phải là tên preset VieNeu hợp lệ.','hint'));
    const pages=el('div',undefined,'pages'), prev=el('button','←','secondary'), next=el('button','→','secondary'), counter=el('span');
    const rows=el('div',undefined,'segments');const warnings=new Set((p.warnings||[]).map(x=>x.id));
    function show(){page=Math.max(0,Math.min(page,Math.ceil(p.segments.length/40)-1));counter.textContent=`Trang ${page+1}/${Math.ceil(p.segments.length/40)}`;prev.disabled=page===0;next.disabled=(page+1)*40>=p.segments.length;renderSegments(rows,editable,warnings);}
    prev.onclick=()=>{page--;show();};next.onclick=()=>{page++;show();};pages.append(prev,counter,next);w.append(pages,rows);show();
  }
}
async function refresh(force=false){
  if(busy)return;busy=true;
  try{
    const all=await api('/projects');$('#projects').replaceChildren();
    for(const p of all){const b=el('button',p.name,'project'+(p.id===selected?' active':''));b.append(el('small',`${labels[p.state]||p.state} · ${p.progress||p.step}`));b.onclick=async()=>{if(dirty&&!confirm('Bỏ các chỉnh sửa chưa lưu?'))return;selected=p.id;page=0;dirty=false;drafts.clear();await refresh(true);};$('#projects').append(b);}
    if(!selected&&all.length)selected=all[0].id;
    if(selected&&!dirty&&!previewAudio){const p=await api(`/projects/${selected}`);const changed=force||!current||p.id!==current.id||p.state!==current.state||p.progress!==current.progress;if(changed){current=p;render();}}
  }catch(e){toast(e.message);}finally{busy=false;}
}
$('#upload').onclick=()=>{
  const file=$('#file').files[0];if(!file){toast('Chọn một video trước.');return;}
  const form=new FormData();form.append('file',file);const xhr=new XMLHttpRequest();xhr.open('POST','/api/projects');
  $('#upload').disabled=true;$('#uploadProgress').hidden=false;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)$('#uploadProgress').value=e.loaded/e.total*100;};
  xhr.onload=()=>{if(xhr.status<300){selected=JSON.parse(xhr.responseText).id;dirty=false;drafts.clear();refresh(true);}else{toast('Upload lỗi: '+xhr.responseText);}$('#upload').disabled=false;$('#uploadProgress').hidden=true;};
  xhr.onerror=()=>{toast('Không thể upload. Kiểm tra kết nối.');$('#upload').disabled=false;};xhr.send(form);
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
refresh();setInterval(()=>refresh(),3000);
