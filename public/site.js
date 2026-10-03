(function(){
  // ---- Generative duotone "micrographs" ----
  function rng(seed){return function(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
  function hex(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function field(type,W,H,r){
    const f=new Float32Array(W*H);
    if(type==='cells'){
      const pts=[];for(let i=0;i<70;i++)pts.push([r()*W,r()*H]);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){let d1=1e9,d2=1e9;for(const p of pts){const dx=p[0]-x,dy=p[1]-y,d=dx*dx+dy*dy;if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
        const e=Math.sqrt(d2)-Math.sqrt(d1);let v=Math.min(1,e/7);v=.25+.6*v+.15*Math.sin(Math.sqrt(d1)*.35);f[y*W+x]=v;}
    }else if(type==='droplets'){
      for(let i=0;i<W*H;i++)f[i]=.12;
      for(let i=0;i<120;i++){const cx=r()*W,cy=r()*H,rad=4+Math.pow(r(),2.2)*34;
        for(let y=Math.max(0,cy-rad|0);y<Math.min(H,cy+rad+1);y++)for(let x=Math.max(0,cx-rad|0);x<Math.min(W,cx+rad+1);x++){const d=Math.hypot(x-cx,y-cy)/rad;if(d<1){const rim=Math.pow(d,6)*.8, hl=Math.max(0,1-Math.hypot(x-(cx-rad*.35),y-(cy-rad*.35))/(rad*.45))*.6;f[y*W+x]=Math.max(f[y*W+x],.3+rim+hl);}}}
    }else{
      for(let i=0;i<W*H;i++)f[i]=.1;
      for(let i=0;i<90;i++){const cx=r()*W,cy=r()*H,a=r()*Math.PI,len=10+r()*16,w=3.2+r()*2;const ca=Math.cos(a),sa=Math.sin(a);
        for(let y=Math.max(0,cy-len-w|0);y<Math.min(H,cy+len+w+1);y++)for(let x=Math.max(0,cx-len-w|0);x<Math.min(W,cx+len+w+1);x++){const dx=x-cx,dy=y-cy,u=dx*ca+dy*sa,v=-dx*sa+dy*ca;const uu=Math.max(0,Math.abs(u)-len/2);const d=Math.hypot(uu,v)/w;if(d<1){f[y*W+x]=Math.max(f[y*W+x],.35+.65*(1-d*d));}}}
    }
    for(let i=0;i<W*H;i++)f[i]=Math.min(1,Math.max(0,f[i]+(r()-.5)*.08));
    return f;
  }
  // Heavy pixel maths runs in a background worker so the page never freezes; falls back to the main thread
  let worker=null,jobs={},jid=0;
  try{const src=rng.toString()+field.toString()+'onmessage=function(e){var d=e.data;var f=field(d.type,d.W,d.H,rng(d.seed));postMessage({id:d.id,f:f},[f.buffer]);};';
    worker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
    worker.onmessage=e=>{const j=jobs[e.data.id];delete jobs[e.data.id];if(j)j(e.data.f);};
    worker.onerror=()=>{worker=null;};}catch(_){worker=null;}
  function paint(cv,seed,done){
    const W=260,H=260,type=cv.dataset.micro;
    if(worker){const id=++jid;jobs[id]=f=>{render(cv,f,W,H);done&&done();};worker.postMessage({id,type,W,H,seed});return;}
    render(cv,field(type,W,H,rng(seed)),W,H);done&&done();
  }
  function render(cv,f,W,H){
    const dk=hex(cv.dataset.dark),lt=hex(cv.dataset.light),off=document.createElement('canvas');off.width=W;off.height=H;
    const ctx=off.getContext('2d'),img=ctx.createImageData(W,H);
    for(let i=0;i<W*H;i++){const t=f[i];for(let c=0;c<3;c++)img.data[i*4+c]=dk[c]+(lt[c]-dk[c])*t;img.data[i*4+3]=255;}
    ctx.putImageData(img,0,0);
    const draw=()=>{const b=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.max(1,b.width*dpr);cv.height=Math.max(1,b.height*dpr);
      const g=cv.getContext('2d');g.imageSmoothingQuality='high';const s=Math.max(cv.width/W,cv.height/H);g.drawImage(off,(cv.width-W*s)/2,(cv.height-H*s)/2,W*s,H*s);};
    draw();new ResizeObserver(draw).observe(cv);
  }
  // Paint lazily: only canvases near the viewport, one per idle slot, so first paint stays fast
  const cvs=[...document.querySelectorAll('canvas[data-micro]')],q=[];let busy=false;
  const idle=window.requestIdleCallback?(f=>requestIdleCallback(f,{timeout:250})):(f=>setTimeout(f,32));
  const pump=()=>{const job=q.shift();if(!job){busy=false;return;}paint(job[0],job[1],()=>idle(pump));};
  const enqueue=c=>{if(c.dataset.painted)return;c.dataset.painted='1';q.push([c,+c.dataset.seed]);if(!busy){busy=true;idle(pump);}};
  cvs.forEach((c,i)=>{c.dataset.seed=17+i*101;c.style.backgroundColor=c.dataset.dark;});
  const startMicro=()=>{if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);enqueue(e.target);}}),{rootMargin:'400px 0px'});cvs.forEach(c=>io.observe(c));}else cvs.forEach(enqueue);};
  if(document.readyState==='complete')setTimeout(startMicro,300);else addEventListener('load',()=>setTimeout(startMicro,300));

  // ---- Test catalogue ----
  // ---- Test catalogue tabs (tables are in the HTML; this only switches them) ----
  document.querySelectorAll('.tabs').forEach(tabs=>{
    const wrap=tabs.parentElement;const btns=[...tabs.querySelectorAll('.tab')];
    const set=k=>{btns.forEach(t=>t.setAttribute('aria-selected',t.dataset.k===k));wrap.querySelectorAll('[data-tab]').forEach(p=>p.hidden=p.dataset.tab!==k);};
    btns.forEach(t=>t.addEventListener('click',()=>set(t.dataset.k)));
  });

  // ---- Claim finder (plans are in the HTML; this only switches them) ----
  const list=document.getElementById('claimList');
  if(list){
    const btns=[...list.querySelectorAll('.claim')];const plans=[...document.querySelectorAll('#plan [data-plan]')];
    const show=i=>{btns.forEach((b,j)=>b.setAttribute('aria-pressed',j===i));plans.forEach((p,j)=>p.hidden=j!==i);};
    btns.forEach((b,i)=>b.addEventListener('click',()=>show(i)));
  }

  // ---- Enquiry form ----
  // Set data-endpoint on the form (e.g. your CRM or form-handler URL) to submit for real.
  const f=document.getElementById('enquiry'), ok=document.getElementById('formOk');
  if(f)f.addEventListener('submit',e=>{
    e.preventDefault();
    if(f.querySelector('[name="website"]')&&f.querySelector('[name="website"]').value)return; // spam trap
    const req=[...f.querySelectorAll('[required]')];let bad=null;
    req.forEach(el=>{const okv=el.value.trim()&&(el.type!=='email'||/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));el.classList.toggle('invalid',!okv);el.setAttribute('aria-invalid',!okv);if(!okv&&!bad)bad=el;});
    ok.hidden=false;
    if(bad){ok.textContent='Please complete the highlighted fields so we can reply.';bad.focus();return;}
    const endpoint=f.dataset.endpoint;
    if(endpoint){
      ok.textContent='Sending…';
      fetch(endpoint,{method:'POST',body:new FormData(f)}).then(r=>{if(!r.ok)throw 0;location.href='/thank-you';})
        .catch(()=>{ok.textContent='Your enquiry could not be sent. Please try again, or message us on WhatsApp.';});
      return;
    }
    const first=(f.querySelector('#f-first')||{value:''}).value.trim();
    ok.textContent='Thanks'+(first?', '+first:'')+'. This is a design preview. On the live site your enquiry goes straight to the product team.';
  });

  // ---- Cookie consent + analytics ----
  // Put your Google Analytics 4 ID here (e.g. 'G-ABC123XYZ'). Analytics loads only after the visitor accepts.
  const GA_ID='G-7PY49T4D7S';
  const store={get(){try{return localStorage.getItem('csl-consent');}catch(_){return null;}},set(v){try{localStorage.setItem('csl-consent',v);}catch(_){}}};
  const loadGA=()=>{if(!GA_ID||window.gtag)return;const sc=document.createElement('script');sc.async=true;sc.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;document.head.appendChild(sc);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config',GA_ID,{anonymize_ip:true});};
  const banner=document.getElementById('consent');
  const choice=store.get();
  if(choice==='accept')loadGA();
  if(banner&&!choice){banner.hidden=false;
    banner.querySelector('[data-consent="accept"]').addEventListener('click',()=>{store.set('accept');banner.hidden=true;loadGA();});
    banner.querySelector('[data-consent="reject"]').addEventListener('click',()=>{store.set('reject');banner.hidden=true;});
  }

  // ---- Navigation: dropdowns + mobile menu ----
  const nav=document.querySelector('.nav');
  if(nav){
    const toggles=[...nav.querySelectorAll('.menu-toggle')];
    const closeAll=except=>toggles.forEach(t=>{if(t!==except){t.setAttribute('aria-expanded','false');t.parentElement.classList.remove('open');}});
    toggles.forEach(t=>{
      t.addEventListener('click',e=>{e.stopPropagation();const open=t.getAttribute('aria-expanded')!=='true';closeAll(t);t.setAttribute('aria-expanded',open);t.parentElement.classList.toggle('open',open);});
    });
    document.addEventListener('click',e=>{if(!nav.contains(e.target))closeAll();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAll();nav.classList.remove('mobile-open');const b=nav.querySelector('.burger');if(b)b.setAttribute('aria-expanded','false');}});
    const burger=nav.querySelector('.burger');
    if(burger)burger.addEventListener('click',()=>{const o=!nav.classList.contains('mobile-open');nav.classList.toggle('mobile-open',o);burger.setAttribute('aria-expanded',o);});
  }

  // ---- Testimonial carousel ----
  document.querySelectorAll('.t-card').forEach(card=>{
    const slides=[...card.querySelectorAll('.t-slide')];if(slides.length<2)return;let i=0;
    const show=n=>{i=(n+slides.length)%slides.length;slides.forEach((s,k)=>s.hidden=k!==i);};
    card.querySelector('.t-prev').addEventListener('click',()=>show(i-1));
    card.querySelector('.t-next').addEventListener('click',()=>show(i+1));
  });

  // ---- Launch timeline calculator ----
  const tc=document.getElementById('timelineCalc');
  if(tc){
    const boxes=[...tc.querySelectorAll('input[type=checkbox]')],extra=tc.querySelector('#tc-markets'),out=tc.querySelector('#tc-total');
    const calc=()=>{
      const v=boxes.map(b=>b.checked?[+b.dataset.min,+b.dataset.max]:[0,0]);
      // formulation runs first; testing and claims run in parallel; regulatory and pilot overlap at the end
      const lo=v[0][0]+Math.max(v[1][0],v[2][0])+Math.max(v[3][0],v[4][0]);
      const hi=v[0][1]+Math.max(v[1][1],v[2][1])+Math.max(v[3][1],v[4][1]);
      const n=Math.max(0,Math.min(10,+extra.value||0));
      out.textContent=(lo+n)+'–'+(hi+2*n)+' weeks';
    };
    boxes.forEach(b=>b.addEventListener('change',calc));extra.addEventListener('input',calc);calc();
  }

  // ---- Newsletter sign-up ----
  // Set data-endpoint on the form to your email platform's sign-up URL.
  document.querySelectorAll('.news-form').forEach(nf=>{
    nf.addEventListener('submit',e=>{
      e.preventDefault();const em=nf.querySelector('input[type=email]'),msg=nf.querySelector('.small');msg.hidden=false;
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value)){em.classList.add('invalid');msg.textContent='Enter a valid business email.';em.focus();return;}
      em.classList.remove('invalid');
      if(nf.dataset.endpoint){fetch(nf.dataset.endpoint,{method:'POST',body:new FormData(nf)}).then(r=>{if(!r.ok)throw 0;msg.textContent='Thank you. We have received your sign-up.';nf.reset();}).catch(()=>{msg.textContent='Could not subscribe. Please try again.';});return;}
      msg.textContent='Thanks. This is a design preview; on the live site you will be subscribed.';
    });
  });

  // ---- Facility tabs ----
  document.querySelectorAll('.fac').forEach(sec=>{
    const tabs=[...sec.querySelectorAll('.fac-tab')],panels=[...sec.querySelectorAll('.fac-panel')];
    const show=i=>{tabs.forEach((t,j)=>t.setAttribute('aria-selected',j===i));panels.forEach((p,j)=>p.hidden=j!==i);};
    tabs.forEach((t,i)=>{t.addEventListener('click',()=>show(i));t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;show(n);tabs[n].focus();}});});
  });

  // ---- About tabs: highlight the section in view ----
  const abt=document.querySelector('.ab-tabs');
  if(abt){const tl=[...abt.querySelectorAll('a[href^="#"]')],scope=abt.closest('.page')||document,secs=tl.map(a=>scope.querySelector('#'+a.getAttribute('href').slice(1)));
    const spy=()=>{if(!abt.offsetParent)return;let cur=tl[0];secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<220)cur=tl[i]});tl.forEach(a=>a.classList.toggle('on',a===cur));};
    addEventListener('scroll',spy,{passive:true});spy();}


  // ---- Report a product problem ----
  const rf=document.getElementById('reportForm');
  if(rf){
    const anon=rf.querySelector('#r-anon'),contact=rf.querySelector('#r-contact'),email=rf.querySelector('#r-email'),ok=rf.querySelector('#reportOk');
    const sync=()=>{contact.hidden=anon.checked;if(anon.checked){email.value='';rf.querySelector('#r-name').value='';}};
    anon.addEventListener('change',sync);sync();
    rf.addEventListener('submit',e=>{
      e.preventDefault();ok.hidden=false;
      if(rf.querySelector('[name="website"]').value)return;
      let bad=null;const mark=(el,v)=>{el.classList.toggle('invalid',!v);el.setAttribute('aria-invalid',!v);if(!v&&!bad)bad=el;};
      rf.querySelectorAll('[required]').forEach(el=>mark(el,el.type==='checkbox'?el.checked:!!el.value.trim()));
      const probs=rf.querySelectorAll('[name="problem_type"]:checked').length;const pb=rf.querySelector('#r-problems');pb.classList.toggle('invalid',!probs);if(!probs&&!bad)bad=pb.querySelector('input');
      if(!anon.checked)mark(email,/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value));
      const files=[...rf.querySelector('#r-photos').files];const fileBad=files.length>3||files.some(f=>f.size>5*1024*1024||!/^image\/(jpeg|png|webp)$/.test(f.type));
      if(fileBad&&!bad)bad=rf.querySelector('#r-photos');
      if(bad){ok.textContent=fileBad&&bad.id==='r-photos'?'Please attach up to 3 JPEG, PNG or WebP images, each under 5 MB.':'Please complete the highlighted fields.';bad.focus();return;}
      if(rf.dataset.endpoint){ok.textContent='Sending your report…';
        fetch(rf.dataset.endpoint,{method:'POST',body:new FormData(rf)}).then(r=>r.json().then(j=>({r,j}))).then(({r,j})=>{if(!r.ok)throw new Error(j.error||'failed');
          ok.innerHTML='Thank you. Your report has been received. Your reference number is <b>'+j.reference+'</b>. Keep it if you contact us about this report.';rf.reset();sync();})
        .catch(()=>{ok.textContent='Your report could not be sent. Please try again, or email info@cosmeticsciencelab.com.';});return;}
      ok.textContent='Thank you. This is a design preview, so nothing was sent. On the live site your report is stored securely and you receive a reference number.';
    });
  }

  // ---- Insights filters (sector, application, market) ----
  const fb=document.getElementById('insFilters');
  if(fb){
    const grid=fb.parentElement.querySelector('.ins-grid'),cards=[...grid.querySelectorAll('.ins-card')];
    const sels=[...fb.querySelectorAll('select')],count=document.getElementById('insCount'),empty=document.getElementById('insEmpty');
    let cat='';const pills=[...document.querySelectorAll('#catPills .cat-pill')];
    const emptyHTML=empty.innerHTML;
    pills.forEach(p=>{const sp=p.querySelector('span');p.dataset.total=cards.filter(c=>!p.dataset.cat||c.dataset.cat===p.dataset.cat).length;if(sp)sp.dataset.soon=sp.textContent;});
    const selMatch=c=>sels.every(s=>!s.value||(c.dataset[s.dataset.key]||'').split(' ').includes(s.value));
    const PER=12;let page=1;
    const pager=document.createElement('nav');pager.className='ins-pager';pager.setAttribute('aria-label','Article pages');grid.after(pager);
    const go=p=>{page=p;apply(true);const t=document.getElementById('catPills')||grid;scrollTo({top:t.getBoundingClientRect().top+scrollY-100,behavior:'smooth'});};
    const apply=(keep)=>{if(keep!==true)page=1;
      const match=cards.filter(c=>(!cat||c.dataset.cat===cat)&&sels.every(s=>!s.value||(c.dataset[s.dataset.key]||'').split(' ').includes(s.value)));
      const n=match.length,pages=Math.max(1,Math.ceil(n/PER));if(page>pages)page=pages;
      const from=(page-1)*PER,to=Math.min(n,from+PER);
      cards.forEach(c=>c.hidden=true);match.forEach((c,i)=>{c.hidden=!(i>=from&&i<to);if(!c.hidden)c.classList.add('in');});
      count.textContent=n?(n>PER?`Showing ${from+1}–${to} of ${n} articles`:n+(n===1?' article':' articles')):'0 articles';empty.hidden=n>0;
      pager.innerHTML='';pager.hidden=pages<2;
      if(pages>1){const btn=(label,p,cls,dis,aria)=>{const b=document.createElement('button');b.type='button';b.className='pg '+(cls||'');b.textContent=label;if(aria)b.setAttribute('aria-label',aria);if(dis)b.disabled=true;else b.addEventListener('click',()=>go(p));if(p===page&&!cls){b.setAttribute('aria-current','page');b.classList.add('on');}pager.appendChild(b);};
        btn('‹ Previous',page-1,'pg-prev',page===1,'Previous page');
        const list=[];for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)list.push(i);else if(list[list.length-1]!=='…')list.push('…');}
        list.forEach(i=>{if(i==='…'){const sp=document.createElement('span');sp.className='pg-gap';sp.textContent='…';pager.appendChild(sp);}else btn(String(i),i,'',false,'Page '+i);});
        btn('Next ›',page+1,'pg-next',page===pages,'Next page');}
      const anySel=sels.some(s=>s.value);
      // category counts follow the sector / application / market filters
      pills.forEach(p=>{const on=p.dataset.cat===cat;p.classList.toggle('on',on);p.setAttribute('aria-selected',on);const sp=p.querySelector('span');if(!sp)return;
        if(+p.dataset.total===0){sp.textContent=sp.dataset.soon;return;}
        sp.textContent=cards.filter(c=>(!p.dataset.cat||c.dataset.cat===p.dataset.cat)&&selMatch(c)).length;});
      // when filters hide every article in a category that has articles, say so and offer to clear them
      const catTotal=cards.filter(c=>!cat||c.dataset.cat===cat).length;
      if(!n&&anySel&&catTotal){const nm=(pills.find(p=>p.dataset.cat===cat)||{}).firstChild;const label=nm?nm.textContent.trim():'this category';
        empty.innerHTML=`No ${label} articles match the sector, application or market you picked. <button type="button" class="link ins-clear">Clear those filters</button> to see all ${catTotal} ${catTotal===1?'article':'articles'} in ${label}.`;
        empty.querySelector('.ins-clear').addEventListener('click',()=>{sels.forEach(s=>s.value='');apply();});}
      else empty.innerHTML=emptyHTML;};
    const setCat=(c,scroll)=>{cat=c||'';apply();if(scroll){const t=document.getElementById('catPills');if(t)setTimeout(()=>scrollTo(0,t.getBoundingClientRect().top+scrollY-100),30);}};
    pills.forEach(p=>p.addEventListener('click',()=>setCat(p.dataset.cat,false)));
    document.querySelectorAll('.cat-card').forEach(b=>b.addEventListener('click',()=>setCat(b.dataset.cat,true)));
    sels.forEach(s=>s.addEventListener('change',()=>apply()));
    document.getElementById('flt-reset').addEventListener('click',()=>{sels.forEach(s=>s.value='');setCat('',false);});
    const fromHash=h=>{const m=/cat-([\w-]+)/.exec(h||'');if(m)setCat(m[1],true);};
    apply();
    fromHash(location.hash);addEventListener('hashchange',()=>fromHash(location.hash));
    addEventListener('spa:go',e=>{if(e.detail&&/^cat-/.test(e.detail.anchor||''))setTimeout(()=>fromHash(e.detail.anchor),80);});
  }

  // ---- Copy article link ----
  document.querySelectorAll('.copy-link').forEach(b=>b.addEventListener('click',()=>{
    const done=()=>{b.textContent='Link copied';setTimeout(()=>b.textContent='Copy link',2000);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(b.dataset.url).then(done).catch(()=>{prompt&&0;b.textContent=b.dataset.url;});}else{b.textContent=b.dataset.url;}
  }));

  // ---- Careers application ----
  const cf=document.getElementById('careerForm');
  if(cf)cf.addEventListener('submit',e=>{
    e.preventDefault();const ok=document.getElementById('careerOk');ok.hidden=false;
    if(cf.querySelector('[name="website"]').value)return;
    let bad=null;
    cf.querySelectorAll('[required]').forEach(el=>{if(el.closest('[hidden]'))return;let v=el.type==='checkbox'?el.checked:el.type==='file'?el.files.length>0:!!el.value.trim();
      if(v&&el.type==='email')v=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
      if(v&&el.type==='file'){const f=el.files[0];v=f.size<=5*1024*1024&&/\.(pdf|docx?)$/i.test(f.name);}
      el.classList.toggle('invalid',!v);el.setAttribute('aria-invalid',!v);if(!v&&!bad)bad=el;});
    if(bad){ok.textContent=bad.type==='file'&&bad.files.length?'Please attach your CV as a PDF or Word file under 5 MB.':'Please complete the highlighted fields.';bad.focus();return;}
    if(cf.dataset.endpoint){ok.textContent='Sending…';fetch(cf.dataset.endpoint,{method:'POST',body:new FormData(cf)}).then(r=>{if(!r.ok)throw 0;ok.textContent='Thank you. Your application has been sent to careers@guires.com. We will be in touch if your profile matches a role.';cf.reset();}).catch(()=>{ok.textContent='Your application could not be sent. Please email your CV to careers@guires.com.';});return;}
    ok.textContent='Thanks, '+cf.querySelector('#c-first').value.trim()+'. This is a design preview. On the live site your application goes to careers@guires.com.';
  });
  document.querySelectorAll('.copy-mail').forEach(b=>b.addEventListener('click',()=>{
    const m=b.dataset.mail;const done=()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy',2000);};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(m).then(done).catch(()=>{});
  }));

  // ---- Contact: switch between New business / Supplier / Partnership forms ----
  document.querySelectorAll('.etype-switch').forEach(sw=>{
    const btns=[...sw.querySelectorAll('button')];
    const show=id=>{btns.forEach(b=>b.setAttribute('aria-selected',b.dataset.form===id));btns.forEach(b=>{const f=document.getElementById(b.dataset.form);if(f)f.hidden=b.dataset.form!==id;});};
    btns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.form)));
  });
  // ---- Generic validation + submit for supplier / partnership forms ----
  const validate=form=>{let bad=null;
    form.querySelectorAll('[required]').forEach(el=>{if(el.closest('[hidden]'))return;
      let v=el.type==='checkbox'?el.checked:el.type==='file'?el.files.length>0:!!el.value.trim();
      if(v&&el.type==='email')v=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
      el.classList.toggle('invalid',!v);el.setAttribute('aria-invalid',!v);if(!v&&!bad)bad=el;});
    form.querySelectorAll('input[type=file]').forEach(el=>{const f=el.files[0];if(f&&f.size>10*1024*1024){el.classList.add('invalid');if(!bad)bad=el;}});
    return bad;};
  document.querySelectorAll('.multi-form').forEach(form=>form.addEventListener('submit',e=>{
    e.preventDefault();const ok=form.querySelector('.form-ok');ok.hidden=false;
    const hp=form.querySelector('[name="website_hp"]');if(hp&&hp.value)return;
    const bad=validate(form);if(bad){ok.textContent='Please complete the highlighted fields.';bad.focus();return;}
    if(form.dataset.endpoint){ok.textContent='Sending…';fetch(form.dataset.endpoint,{method:'POST',body:new FormData(form)}).then(r=>{if(!r.ok)throw 0;location.href='/thank-you';}).catch(()=>{ok.textContent='Could not send. Please email info@cosmeticsciencelab.com.';});return;}
    ok.textContent='Thanks. This is a design preview. On the live site this enquiry goes straight to the right team.';
  }));
  // ---- Careers: job vs internship ----
  const at=document.querySelector('.app-type');
  if(at){const intern=document.querySelector('.intern-only'),role=document.getElementById('c-role'),jobBits=[role.closest('.f2'),document.getElementById('c-notice').closest('.field')];
    const set=()=>{const isI=at.querySelector('input:checked').value==='Internship';intern.hidden=!isI;jobBits.forEach(x=>x.hidden=isI);
      intern.querySelectorAll('[data-req-intern]').forEach(el=>el.required=isI);role.required=!isI;};
    at.querySelectorAll('input').forEach(i=>i.addEventListener('change',set));set();}
})();
/* ==== MOTION LAYER (futuristic / AI) ==== */
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root=document.documentElement; root.classList.add('motion');
  /* scroll progress + glass nav */
  var bar=document.createElement('div'); bar.className='scroll-prog'; bar.setAttribute('aria-hidden','true'); document.body.appendChild(bar);
  var nav=document.querySelector('.nav');
  function onScroll(){var h=root.scrollHeight-root.clientHeight; bar.style.transform='scaleX('+(h>0?root.scrollTop/h:0)+')'; if(nav) nav.classList.toggle('nav-glass',scrollY>8);}
  addEventListener('scroll',onScroll,{passive:true}); onScroll();

  /* scroll reveal with stagger */
  var SEL='.block .head,.two-col > .sticky,.rows > div,.deliver > div,.ev-card,.mk-svc,.pkg,.concept,.pillar,.signal,.tq,.sec-card,.values > div,.tm,.tl li,.kw-intro p,.entry article,.founder,.story,.ai-card,.faq details,.related a,.moments li,.recv li,.needs li,.group-photo,.loc-map,.steps li,.art-card,.ins-grid > *,.cats span,.cat-card';
  var els=[].slice.call(document.querySelectorAll(SEL));
  var vh=window.innerHeight||800;
  els=els.filter(function(el){var r=el.getBoundingClientRect();return !(r.height&&r.top<vh&&r.bottom>0);});
  els.forEach(function(el){
    el.classList.add('rv');
    var sib=el.parentNode?[].indexOf.call(el.parentNode.children,el):0;
    el.style.setProperty('--d',(Math.min(sib,8)*70)+'ms');
  });
  if(RM||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});}
  else{
    var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    els.forEach(function(e){io.observe(e)});
  }

  /* count-up numbers */
  var nums=[].slice.call(document.querySelectorAll('.stat strong:not(.txt),.founder-stats strong,.story-badge b'));
  function countUp(el){
    var m=/^(\d+)(.*)$/.exec(el.textContent.trim()); if(!m||RM) return;
    var end=+m[1],suf=m[2],t0=null,dur=1400;
    function step(t){if(!t0)t0=t;var p=Math.min((t-t0)/dur,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(end*e)+suf;if(p<1)requestAnimationFrame(step);}
    requestAnimationFrame(step);
  }
  if('IntersectionObserver' in window){
    var io2=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){countUp(e.target);io2.unobserve(e.target);}})},{threshold:.6});
    nums.forEach(function(n){io2.observe(n)});
  }

  /* heavy effects wait until the page has loaded and the browser is idle */
  var READY=[],fired=false;
  function fire(){if(fired)return;fired=true;READY.forEach(function(f){f();});READY.push=function(f){f();};}
  function later(){(window.requestIdleCallback?function(f){requestIdleCallback(f,{timeout:2500})}:function(f){setTimeout(f,1200)})(fire);}
  if(document.readyState==='complete')setTimeout(later,2500);else addEventListener('load',function(){setTimeout(later,2500);});
  ['pointerdown','keydown','wheel','touchstart'].forEach(function(ev){addEventListener(ev,fire,{once:true,passive:true});});
  /* neural-network canvas behind heroes and dark bands */
  var hosts=[].slice.call(document.querySelectorAll('.page-hero,.sec-hero,.banner,.visit-band,.callout,.ai-sec,.contact-card'));
  hosts.forEach(function(host){
    var dark=host.classList.contains('banner')||host.classList.contains('sec-hero')||host.classList.contains('visit-band')||host.classList.contains('callout')||host.classList.contains('ai-sec')||host.classList.contains('contact-card');
    var cv=document.createElement('canvas'); cv.className='neural'; cv.setAttribute('aria-hidden','true');
    host.insertBefore(cv,host.firstChild);
    var ctx=cv.getContext('2d'),W=0,H=0,pts=[],mouse={x:-9999,y:-9999},run=false,raf=0,dpr=Math.min(window.devicePixelRatio||1,2);
    var col=dark?'217,166,255':'161,0,255';
    function size(){var r=host.getBoundingClientRect();W=r.width;H=r.height;if(!W||!H)return;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
      var n=Math.round(Math.min(60,Math.max(22,W*H/20000)));pts=[];for(var i=0;i<n;i++)pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:1+Math.random()*1.8,p:Math.random()*6.28});}
    function frame(){
      ctx.clearRect(0,0,W,H);
      var L=Math.min(150,W/7);
      for(var i=0;i<pts.length;i++){var a=pts[i];
        a.x+=a.vx;a.y+=a.vy;if(a.x<0||a.x>W)a.vx*=-1;if(a.y<0||a.y>H)a.vy*=-1;a.p+=.03;
        var dx=mouse.x-a.x,dy=mouse.y-a.y,dm=Math.sqrt(dx*dx+dy*dy);if(dm<160){a.x+=dx*.004;a.y+=dy*.004;}
        for(var j=i+1;j<pts.length;j++){var b=pts[j],x=a.x-b.x,y=a.y-b.y,d=Math.sqrt(x*x+y*y);
          if(d<L){ctx.strokeStyle='rgba('+col+','+((1-d/L)*(dark?.35:.22))+')';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
        var g=.45+.35*Math.sin(a.p);ctx.fillStyle='rgba('+col+','+(dark?g:g*.7)+')';ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,6.283);ctx.fill();
      }
      if(run)raf=requestAnimationFrame(tick);
    }
    var last=0;function tick(t){if(t-last<33){if(run)raf=requestAnimationFrame(tick);return;}last=t;frame();}
    host.addEventListener('mousemove',function(e){var r=host.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
    host.addEventListener('mouseleave',function(){mouse.x=mouse.y=-9999;});
    function start(){if(run)return;size();if(!W)return;run=true;cv.classList.add('on');if(RM){run=false;frame();return;}raf=requestAnimationFrame(tick);}
    function stop(){run=false;cancelAnimationFrame(raf);}
    function arm(){if('IntersectionObserver' in window){new IntersectionObserver(function(en){en.forEach(function(e){e.isIntersecting?start():stop()})},{threshold:0}).observe(host);}else start();}
    READY.push(arm);
    addEventListener('resize',function(){if(run){size();}});
  });

  /* subtle 3D tilt on cards */
  if(!RM&&matchMedia('(hover:hover)').matches){
    [].forEach.call(document.querySelectorAll('.ev-card,.mk-svc,.concept,.pkg,.sec-card,.tq,.ai-card,.tm'),function(c){
      c.classList.add('tilt');
      c.addEventListener('mousemove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        c.style.setProperty('--rx',(-y*5).toFixed(2)+'deg');c.style.setProperty('--ry',(x*6).toFixed(2)+'deg');c.style.setProperty('--mx',((x+.5)*100).toFixed(1)+'%');c.style.setProperty('--my',((y+.5)*100).toFixed(1)+'%');});
      c.addEventListener('mouseleave',function(){c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg');});
    });
  }

  /* AI terminal typing */
  [].forEach.call(document.querySelectorAll('.ai-term'),function(t){
    var lines=JSON.parse(t.getAttribute('data-lines')||'[]'),done=false;
    function type(){if(done)return;done=true;t.innerHTML='';var li=0;
      (function next(){if(li>=lines.length){t.insertAdjacentHTML('beforeend','<span class="cur"></span>');return;}
        var L=lines[li++],row=document.createElement('div');t.appendChild(row);var k=0,txt=L[0];
        (function ch(){row.textContent=txt.slice(0,++k);if(k<txt.length&&!RM){setTimeout(ch,14);}else{if(L[1])row.insertAdjacentHTML('beforeend',' <span class="'+L[2]+'">'+L[1]+'</span>');setTimeout(next,RM?0:260);}})();})();}
    if('IntersectionObserver' in window){var o=new IntersectionObserver(function(en){if(en[0].isIntersecting){type();o.disconnect();}},{threshold:.4});o.observe(t);}else type();
  });

  /* re-run reveal/network sizing when the single-file preview switches page */
  addEventListener('hashchange',function(){setTimeout(function(){dispatchEvent(new Event('resize'));onScroll();},60);});
})();

/* ==== site search ==== */
(function(){
  const btns=document.querySelectorAll('.nav-search');if(!btns.length)return;
  let IDX=window.CSL_SEARCH||null,loading=null;
  const load=()=>IDX?Promise.resolve(IDX):(loading=loading||fetch(document.documentElement.dataset.searchIndex||'/search-index.json').then(r=>r.json()).then(d=>IDX=d).catch(()=>IDX=[]));
  const box=document.createElement('div');box.className='srch';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Search Cosmetic Science Lab');
  box.innerHTML='<div class="srch-box"><div class="srch-top"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" placeholder="Search services, ingredients, guides, markets…" aria-label="Search" autocomplete="off"><button class="srch-close" type="button">Esc</button></div><ul class="srch-list" role="listbox"></ul><p class="srch-hint">Try “ISO 11930”, “niacinamide”, “MoCRA” or “sunscreen”.</p></div>';
  document.body.appendChild(box);
  const inp=box.querySelector('input'),list=box.querySelector('.srch-list'),hint=box.querySelector('.srch-hint');let sel=0,last=null;
  const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const render=()=>{const q=norm(inp.value.trim());if(!q){list.innerHTML='';hint.hidden=false;return;}hint.hidden=true;
    const words=q.split(/\s+/);
    const res=IDX.map(p=>{const t=norm(p.t),d=norm(p.d+' '+p.k);let s=0;for(const w of words){if(t.includes(w))s+=t.startsWith(w)?6:4;else if(d.includes(w))s+=1;else return null;}return [s,p];}).filter(Boolean).sort((a,b)=>b[0]-a[0]).slice(0,12);
    sel=0;list.innerHTML=res.length?res.map(([,p],i)=>`<li><a href="${esc(p.u)}" class="${i?'':'on'}"><span class="srch-type">${esc(p.y)}</span><b>${esc(p.t)}</b><small>${esc(p.d)}</small></a></li>`).join(''):'<li class="srch-empty">No pages match. Try a shorter word, or <a href="'+esc((IDX.find(p=>p.y==='Contact')||{u:'contact.html'}).u)+'">ask a scientist</a>.</li>';};
  const open=()=>{last=document.activeElement;box.hidden=false;document.body.style.overflow='hidden';load().then(()=>{render();});setTimeout(()=>inp.focus(),20);};
  const close=()=>{box.hidden=true;document.body.style.overflow='';if(last&&last.focus)last.focus();};
  btns.forEach(b=>b.addEventListener('click',open));
  box.addEventListener('click',e=>{if(e.target===box||e.target.closest('.srch-close'))close();else if(e.target.closest('.srch-list a'))setTimeout(close,0);});
  inp.addEventListener('input',render);
  inp.addEventListener('keydown',e=>{const a=[...list.querySelectorAll('a')];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!a.length)return;a[sel].classList.remove('on');sel=(sel+(e.key==='ArrowDown'?1:-1)+a.length)%a.length;a[sel].classList.add('on');a[sel].scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&a[sel]){e.preventDefault();a[sel].click();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)close();else if((e.key==='/'&&!/input|textarea|select/i.test((document.activeElement||{}).tagName||''))||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')){e.preventDefault();open();}});
})();
