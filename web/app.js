const $ = s => document.querySelector(s);
let selected = null, current = null, dirty = false, page = 0, busy = false, filterWarnings = false;
function countWords(s){ return (s||'').trim().split(/\s+/).filter(Boolean).length; }
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
const VOICES = [
  { group: "⭐ Đề xuất hàng đầu", items: [
    { id: "Hải Đăng", label: "Hải Đăng (Nam Bắc - Chuẩn/Mặc định)" },
    { id: "Mai Anh", label: "Mai Anh (Nữ Bắc - Tự nhiên)" },
    { id: "Trúc Ly", label: "Trúc Ly (Nữ Nam - Truyền cảm)" },
    { id: "Thiện Minh", label: "Thiện Minh (Nam Bắc - Trầm ấm)" },
    { id: "Thùy Dung", label: "Thùy Dung (Nữ Nam - Dịu dàng)" },
    { id: "Ngọc Huyền", label: "Ngọc Huyền (Nữ Bắc - Nhẹ nhàng)" },
    { id: "Quang Sơn", label: "Quang Sơn (Nam Trung - Truyền cảm)" },
    { id: "Ngọc Trân", label: "Ngọc Trân (Nữ Trung - Ngọt ngào)" },
    { id: "Thiền Tâm Đức", label: "Thiền Tâm Đức (Nam - Phật pháp/Trầm)" },
    { id: "Adam bựa", label: "Adam bựa (Nam - Hài hước/Vlog)" }
  ]},
  { group: "🏙️ Miền Bắc", items: [
    { id: "Minh Đức", label: "Minh Đức (Nam Bắc)" },
    { id: "Phạm Tuyên", label: "Phạm Tuyên (Nam Bắc)" },
    { id: "Xuân Vĩnh", label: "Xuân Vĩnh (Nam Bắc)" },
    { id: "Thanh Bình", label: "Thanh Bình (Nam Bắc)" },
    { id: "Quốc Tuấn", label: "Quốc Tuấn (Nam Bắc)" },
    { id: "Ngọc Linh", label: "Ngọc Linh (Nữ Bắc)" },
    { id: "Đoan Trang", label: "Đoan Trang (Nữ Bắc)" },
    { id: "Quỳnh Anh", label: "Quỳnh Anh (Nữ Bắc)" }
  ]},
  { group: "🏖️ Miền Trung", items: [
    { id: "Quang Sơn", label: "Quang Sơn (Nam Trung)" },
    { id: "Ngọc Trân", label: "Ngọc Trân (Nữ Trung)" }
  ]},
  { group: "🌴 Miền Nam", items: [
    { id: "Thái Sơn", label: "Thái Sơn (Nam Nam)" },
    { id: "Minh Triết", label: "Minh Triết (Nam Nam)" },
    { id: "Đức Trí", label: "Đức Trí (Nam Nam)" },
    { id: "Adam", label: "Adam (Nam Nam)" },
    { id: "Thục Đoan", label: "Thục Đoan (Nữ Nam)" },
    { id: "Mỹ Duyên", label: "Mỹ Duyên (Nữ Nam)" },
    { id: "Kim Thanh", label: "Kim Thanh (Nữ Nam)" }
  ]}
];
function buildVoiceSelect(currentVoice){
  const select = el('select');
  select.id = 'voice';
  let matched = false;
  for(const g of VOICES){
    const grp = el('optgroup');
    grp.label = g.group;
    for(const v of g.items){
      const opt = el('option', v.label);
      opt.value = v.id;
      if(v.id === currentVoice){opt.selected = true; matched = true;}
      grp.append(opt);
    }
    select.append(grp);
  }
  if(!matched && currentVoice){
    const grp = el('optgroup');
    grp.label = 'Giọng khác';
    const opt = el('option', currentVoice);
    opt.value = currentVoice;
    opt.selected = true;
    grp.append(opt);
    select.prepend(grp);
  }
  select.onchange = ()=>{stopPreview(); dirty = true;};
  return select;
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
function renderSegments(container, editable, warningsMap, list){
  stopPreview();
  container.replaceChildren();
  for(const s of list.slice(page*40,(page+1)*40)){
    const w = warningsMap.get(s.id);
    const segDuration = Math.max(0.1, s.end - s.start);
    const row = el('div', undefined, 'segment' + (w ? ' warning' : ''));
    
    const actions = el('div');
    const t = el('button', `${time(s.start)} → ${time(s.end)}`, 'time secondary');
    t.onclick = () => { stopPreview(); $('video').currentTime = s.start; };
    actions.append(t);

    if (w) {
      actions.append(el('div', `⚠️ Vượt +${w.overflow_seconds}s`, 'warning-badge'));
      const timingBox = el('div', undefined, 'timing-info');
      const maxSec = w.available_seconds ? w.available_seconds : segDuration.toFixed(1);
      const actSec = w.actual_seconds ? w.actual_seconds : (segDuration + w.overflow_seconds).toFixed(1);
      timingBox.innerHTML = `Thực tế: <b>${actSec}s</b><br>Tối đa: ${maxSec}s`;
      actions.append(timingBox);
    } else {
      actions.append(el('div', `${segDuration.toFixed(1)}s`, 'timing-info'));
    }

    const listen = el('button', 'Nghe thử', 'secondary');
    listen.style.marginTop = '8px';
    listen.setAttribute('aria-label', `Nghe audio tiếng Việt ${s.id}`);
    listen.onclick = () => playSnippet(s, listen);
    actions.append(listen);
    row.append(actions);

    row.append(el('div', s.source, 'source'));

    const editCol = el('div');
    const area = el('textarea');
    area.value = drafts.get(s.id) ?? s.translation;
    area.disabled = !editable;
    area.setAttribute('aria-label', `Bản dịch ${s.id}`);
    if (w) area.title = `Câu vượt thời lượng (+${w.overflow_seconds}s). Hãy rút gọn số từ.`;
    editCol.append(area);

    const counterDiv = el('div', undefined, 'word-counter');
    const availableSec = w ? (w.available_seconds || segDuration) : segDuration;
    const targetMaxWords = Math.max(1, Math.round(availableSec * 3.5));

    function updateWordCounter() {
      const curText = drafts.get(s.id) ?? area.value ?? '';
      const words = countWords(curText);
      counterDiv.replaceChildren();

      const labelSpan = el('span');
      labelSpan.innerHTML = `Số từ: <b>${words}</b> / Tối đa: ~${targetMaxWords} từ`;
      counterDiv.append(labelSpan);

      if (w || words > targetMaxWords) {
        if (words > targetMaxWords) {
          counterDiv.append(el('span', `Vượt ${words - targetMaxWords} từ`, 'badge-excess'));
        } else {
          counterDiv.append(el('span', 'Độ dài an toàn ✓', 'badge-ok'));
        }
      }
    }
    updateWordCounter();

    area.oninput = () => {
      stopPreview();
      drafts.set(s.id, area.value);
      dirty = true;
      updateWordCounter();
    };
    editCol.append(counterDiv);
    row.append(editCol);

    container.append(row);
  }
}
function initUploadForm(){
  const uploadVoice=$('#uploadVoice');
  if(uploadVoice&&!uploadVoice.children.length){
    for(const g of VOICES){
      const grp=el('optgroup');grp.label=g.group;
      for(const v of g.items){
        const opt=el('option',v.label);opt.value=v.id;
        if(v.id==='Hải Đăng')opt.selected=true;
        grp.append(opt);
      }
      uploadVoice.append(grp);
    }
  }
}
function renderPipeline(p){
  const steps=[
    {key:'extract',name:'1. Trích xuất'},
    {key:'stt',name:'2. Nhận dạng STT'},
    {key:'translate',name:'3. Dịch thuật'},
    {key:'tts',name:'4. Tạo giọng TTS'},
    {key:'export',name:'5. Xuất audio'}
  ];
  const keys=steps.map(s=>s.key);
  const currentIdx=keys.indexOf(p.step);
  const state=p.state;

  let stagePct=0;
  const match=(p.progress||'').match(/(\d+)\s*\/\s*(\d+)/);
  if(match){
    const cur=parseInt(match[1],10),tot=parseInt(match[2],10);
    if(tot>0)stagePct=Math.min(100,Math.round((cur/tot)*100));
  }else if(state==='running'&&p.step==='extract'){
    stagePct=50;
  }else if(state==='completed'){
    stagePct=100;
  }

  let overallPct=0;
  if(state==='completed'){
    overallPct=100;
  }else if(currentIdx>=0){
    if(state==='review'){
      overallPct=60;
    }else{
      overallPct=Math.min(99,Math.round(currentIdx*20+stagePct*0.2));
    }
  }

  const card=el('div',undefined,'pipeline-card');
  const stepsEl=el('div',undefined,'pipeline-steps');

  steps.forEach((s,idx)=>{
    const item=el('div',undefined,'step-item');
    let itemState='pending';
    if(state==='completed'){
      itemState='completed';
    }else if(idx<currentIdx){
      itemState='completed';
    }else if(idx===currentIdx){
      if(state==='running')itemState='running';
      else if(state==='review')itemState='review';
      else if(state==='failed')itemState='failed';
      else if(state==='queued')itemState='running';
    }
    item.classList.add(itemState);

    const circle=el('div',undefined,'step-circle');
    if(itemState==='completed'){
      circle.textContent='✓';
    }else if(itemState==='running'){
      circle.textContent=stagePct>0?`${stagePct}%`:'▶';
    }else if(itemState==='review'){
      circle.textContent='✎';
    }else if(itemState==='failed'){
      circle.textContent='!';
    }else{
      circle.textContent=`${idx+1}`;
    }
    item.append(circle);
    item.append(el('div',s.name,'step-label'));
    stepsEl.append(item);

    if(idx<steps.length-1){
      const line=el('div',undefined,'step-line'+(idx<currentIdx||state==='completed'?' completed':''));
      stepsEl.append(line);
    }
  });

  const barWrapper=el('div',undefined,'pipeline-bar-wrapper');
  const bar=el('div',undefined,'pipeline-bar');
  const fill=el('div',undefined,'pipeline-fill');
  fill.style.width=`${overallPct}%`;
  bar.append(fill);

  const statusRow=el('div',undefined,'pipeline-status');
  let detailDesc=p.progress||labels[state]||state;
  if(state==='review'){
    detailDesc='Dịch xong · Đang dừng để bạn duyệt bản dịch';
  }else if(state==='completed'){
    detailDesc='Hoàn tất toàn bộ tiến trình · Đã tạo xong file';
  }else if(state==='running'){
    const curName=steps[currentIdx]?steps[currentIdx].name:p.step;
    detailDesc=`Đang xử lý: ${curName} ${p.progress?`(${p.progress})`:''} - ${stagePct}%`;
  }
  statusRow.append(el('span',detailDesc,'status-desc'));
  statusRow.append(el('span',`${overallPct}% hoàn thành`,'percent-text'));

  barWrapper.append(bar,statusRow);
  card.append(stepsEl,barWrapper);
  return card;
}
function render(){
  stopPreview();
  const w=$('#workspace');w.replaceChildren(); const p=current;
  const heading=el('div',undefined,'heading');heading.append(el('h2',p.name),el('span',labels[p.state]||p.state,'status'));w.append(heading);
  w.append(renderPipeline(p));
  w.append(el('p',`${p.progress} · ${p.segments.length} đoạn · ${time(p.duration)}`));
  const video=el('video');video.controls=true;video.preload='metadata';video.src=`/api/projects/${p.id}/files/source`;w.append(video);
  if(p.error)w.append(el('pre',p.error,'error'));
  
  const tools=el('div',undefined,'toolbar');
  tools.append(el('label','Giọng đọc: '));
  const voiceSelect=buildVoiceSelect(p.voice);
  voiceSelect.onchange=async()=>{
    stopPreview();dirty=true;
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:voiceSelect.value})});
      p.voice=voiceSelect.value;toast('Đã đổi giọng đọc sang: '+voiceSelect.value);
    }catch(e){toast(e.message);}
  };
  tools.append(voiceSelect);

  const pauseLabel=el('label',undefined,'checkbox-label');
  const pauseCb=el('input');pauseCb.type='checkbox';
  pauseCb.checked=(p.pause_review!==0);
  pauseCb.onchange=async()=>{
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pause_review:pauseCb.checked})});
      p.pause_review=pauseCb.checked?1:0;
      toast(pauseCb.checked?'Đã bật: Sẽ dừng lại để bạn duyệt bản dịch':'Đã tắt: Sẽ tự động chạy từ đầu tới cuối');
    }catch(e){toast(e.message);pauseCb.checked=!pauseCb.checked;}
  };
  pauseLabel.append(pauseCb,el('span','Dừng để duyệt'));
  tools.append(pauseLabel);

  const autoFitLabel=el('label',undefined,'checkbox-label');
  const autoFitCb=el('input');autoFitCb.type='checkbox';
  autoFitCb.checked=(p.auto_fit!==0);
  autoFitCb.onchange=async()=>{
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({auto_fit:autoFitCb.checked})});
      p.auto_fit=autoFitCb.checked?1:0;
      toast(autoFitCb.checked?'Đã bật: Tự động nén âm thanh vừa thời gian':'Đã tắt: Chế độ kiểm tra nghiêm ngặt');
    }catch(e){toast(e.message);autoFitCb.checked=!autoFitCb.checked;}
  };
  autoFitLabel.append(autoFitCb,el('span','Tự nén âm thanh vừa thời gian'));
  tools.append(autoFitLabel);

  const editable=['review','failed','completed'].includes(p.state);
  if(editable&&p.segments.length){
    const saveButton=el('button','Lưu bản dịch','secondary');saveButton.onclick=async()=>{try{await save();toast('Đã lưu');await refresh(true);}catch(e){toast(e.message);}};tools.append(saveButton);
    const generate=el('button','Lưu & tạo audio');generate.onclick=()=>act('generate');tools.append(generate);
  }
  if(['running','queued'].includes(p.state)){const b=el('button','Hủy xử lý','secondary');b.onclick=()=>act('cancel');tools.append(b);}
  if(['failed','cancelled'].includes(p.state)){const b=el('button','Thử lại bước hiện tại','secondary');b.onclick=()=>act('resume');tools.append(b);}
  w.append(tools);
  if(p.exports.includes('narration.mp3')){const audio=el('audio');audio.controls=true;audio.src=`/api/projects/${p.id}/files/narration.mp3`;w.append(audio);}
  const downloads=el('div',undefined,'downloads');for(const name of p.exports){const a=el('a',name,'download');a.href=`/api/projects/${p.id}/files/${name}`;a.download=name;downloads.append(a);}w.append(downloads);
  if(p.segments.length){
    w.append(el('p','Nhấn mốc thời gian để nghe lời gốc. Bấm "Nghe thử" để nghe âm thanh tiếng Việt. Viền cam: câu vượt thời lượng cần rút gọn.','hint'));

    const warningsMap = new Map((p.warnings||[]).map(x=>[x.id, x]));
    const warnCount = warningsMap.size;

    const filterTabs = el('div', undefined, 'filter-tabs');
    const allTab = el('button', `Tất cả (${p.segments.length})`, 'tab-btn' + (!filterWarnings ? ' active' : ''));
    filterTabs.append(allTab);

    const warnTab = el('button', `⚠️ Câu vượt thời lượng (${warnCount})`, 'tab-btn warning-tab' + (filterWarnings ? ' active' : ''));
    if(warnCount === 0) warnTab.style.opacity = '0.6';
    filterTabs.append(warnTab);

    if(warnCount > 0 && editable){
      const trimBtn = el('button', `✂️ Tự cắt từ cho đủ (${warnCount} câu)`, 'tab-btn auto-trim-btn');
      trimBtn.title = 'Tự động cắt ngắn số từ của các câu bị dài về giới hạn an toàn';
      trimBtn.onclick = () => {
        let trimmed = 0;
        for(const s of p.segments){
          const w = warningsMap.get(s.id);
          if(!w) continue;
          const curText = drafts.get(s.id) ?? s.translation ?? '';
          const words = curText.trim().split(/\s+/).filter(Boolean);
          const segDuration = Math.max(0.1, s.end - s.start);
          const availableSec = w.available_seconds || segDuration;
          const targetMax = Math.max(1, Math.round(availableSec * 3.5));
          if(words.length > targetMax){
            drafts.set(s.id, words.slice(0, targetMax).join(' '));
            dirty = true;
            trimmed++;
          }
        }
        if(trimmed > 0){
          toast(`Đã tự động rút gọn ${trimmed} câu về độ dài an toàn. Bấm "Lưu bản dịch" để xác nhận!`);
          show();
        } else {
          toast('Tất cả các câu đã nằm trong độ dài an toàn.');
        }
      };
      filterTabs.append(trimBtn);
    }
    w.append(filterTabs);

    const pages=el('div',undefined,'pages'), prev=el('button','←','secondary'), next=el('button','→','secondary'), counter=el('span');
    const rows=el('div',undefined,'segments');

    function getVisibleSegments(){
      return filterWarnings ? p.segments.filter(s=>warningsMap.has(s.id)) : p.segments;
    }

    function show(){
      const list = getVisibleSegments();
      const maxPage = Math.max(1, Math.ceil(list.length / 40));
      page = Math.max(0, Math.min(page, maxPage - 1));

      allTab.className = 'tab-btn' + (!filterWarnings ? ' active' : '');
      warnTab.className = 'tab-btn warning-tab' + (filterWarnings ? ' active' : '');

      if(list.length === 0){
        rows.replaceChildren();
        rows.append(el('p', filterWarnings ? '🎉 Tuyệt vời! Không có câu nào vượt thời lượng.' : 'Không có đoạn thoại nào.', 'hint'));
        counter.textContent = '0 câu';
        prev.disabled = true;
        next.disabled = true;
        return;
      }

      counter.textContent = `Trang ${page+1}/${maxPage} (${list.length} câu)`;
      prev.disabled = page === 0;
      next.disabled = (page+1)*40 >= list.length;
      renderSegments(rows, editable, warningsMap, list);
    }

    allTab.onclick = () => { filterWarnings = false; page = 0; show(); };
    warnTab.onclick = () => { filterWarnings = true; page = 0; show(); };

    prev.onclick=()=>{page--;show();};next.onclick=()=>{page++;show();};pages.append(prev,counter,next);w.append(pages,rows);show();
  }
}
async function refresh(force=false){
  if(busy)return;busy=true;
  try{
    const all=await api('/projects');$('#projects').replaceChildren();
    for(const p of all){const b=el('button',p.name,'project'+(p.id===selected?' active':''));b.append(el('small',`${labels[p.state]||p.state} · ${p.progress||p.step}`));b.onclick=async()=>{if(dirty&&!confirm('Bỏ các chỉnh sửa chưa lưu?'))return;selected=p.id;page=0;dirty=false;drafts.clear();filterWarnings=false;await refresh(true);};$('#projects').append(b);}
    if(!selected&&all.length)selected=all[0].id;
    if(selected&&!dirty&&!previewAudio){const p=await api(`/projects/${selected}`);const changed=force||!current||p.id!==current.id||p.state!==current.state||p.progress!==current.progress;if(changed){current=p;render();}}
  }catch(e){toast(e.message);}finally{busy=false;}
}
$('#upload').onclick=()=>{
  const file=$('#file').files[0];if(!file){toast('Chọn một video trước.');return;}
  const form=new FormData();
  form.append('file',file);
  const voiceEl=$('#uploadVoice');
  if(voiceEl&&voiceEl.value)form.append('voice',voiceEl.value);
  const pauseEl=$('#uploadPauseReview');
  form.append('pause_review',pauseEl&&pauseEl.checked?'1':'0');
  const autoFitEl=$('#uploadAutoFit');
  form.append('auto_fit',autoFitEl&&autoFitEl.checked?'1':'0');
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/projects');
  $('#upload').disabled=true;$('#uploadProgress').hidden=false;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)$('#uploadProgress').value=e.loaded/e.total*100;};
  xhr.onload=()=>{if(xhr.status<300){selected=JSON.parse(xhr.responseText).id;dirty=false;drafts.clear();refresh(true);}else{toast('Upload lỗi: '+xhr.responseText);}$('#upload').disabled=false;$('#uploadProgress').hidden=true;};
  xhr.onerror=()=>{toast('Không thể upload. Kiểm tra kết nối.');$('#upload').disabled=false;};xhr.send(form);
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
initUploadForm();
refresh();setInterval(()=>refresh(),3000);
