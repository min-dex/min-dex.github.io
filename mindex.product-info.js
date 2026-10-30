// Optional diagnostics; absence of a build receipt never asserts a release version.
(() => {
 if (isPresenterOutputRoute()) return;
 const panel=document.querySelector('.monitor-panel');if(!panel)return;
 const section=document.createElement('section');section.className='monitor-section';
 const title=document.createElement('h3');title.textContent='앱 정보';
 const label=document.createElement('p');label.textContent='빌드 정보 확인 중';
 section.append(title,label);panel.append(section);
 void (async()=>{
  try{
   const desktop=window.mindexElectron?.isDesktop;
   const info=desktop?await window.mindexElectron.getBuildInfo?.():null;
   const build=desktop?info?.build:await fetch('./mindex-build.json',{cache:'no-store'}).then(r=>r.ok?r.json():null);
   if(!build||build.schema!==1||!/^\d+\.\d+\.\d+$/.test(build.productVersion)||!['development','test','release'].includes(build.channel)){
    label.textContent=desktop?`설치 앱 ${info?.installedVersion||'버전 확인 불가'} · 제품 배포 정보 없음`:'웹 개발 빌드 · 제품 배포 정보 없음';return;
   }
   label.textContent=build.channel==='release'?`Mindex ${build.productVersion}`:`${build.channel==='test'?'테스트 앱':'개발 빌드'} · 목표 버전 ${build.productVersion}`;
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='변경 내역 · 빌드 정보';details.append(summary);
   const list=document.createElement('ul');for(const text of build.changes||[]){const li=document.createElement('li');li.textContent=text;list.append(li);}details.append(list);
   const diagnostic=document.createElement('p');diagnostic.className='monitor-environment';
   diagnostic.textContent=[desktop?`설치 버전 ${info?.installedVersion||'확인 불가'}`:'웹',`빌드 ${build.buildVersion}`,`소스 ${String(build.sourceCommit||'').slice(0,12)}`].join(' · ');details.append(diagnostic);
   const note=document.createElement('p');note.textContent=build.upgradeNotes||'';details.append(note);section.append(details);
  }catch{label.textContent='빌드 정보를 확인하지 못했어요.';}
 })();
})();
