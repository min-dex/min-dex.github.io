(function () {
  "use strict";
  const MM = 72 / 25.4;
  const TOKENS = Object.freeze({width:297, height:210, fold:148.5, inset:5, content:10, grid:2.5, baseline:2.5,
    fontSizes:[7.5,8,9,10,11,11.5,12.5,15,17.5,20,22.5,25,27.5,30,35,40,45]});
  const SVG = "http://www.w3.org/2000/svg";
  // Reuse MINDEX's worship artwork. Legacy theme keys preserve saved drafts.
  const themeArtwork={water:"26-A5.png",aurora:"26-A1.png",lent:"26-A2.png",palm:"26-S4.png",pentecost:"26-S6.png",stars:"26-A3.png"};
  const artworkPath=key=>`assets/worship-backgrounds/${themeArtwork[key]}`;
  const logoPath="assets/bulletin/ria-mark.webp";
  const inkLogoPath="assets/bulletin/ria-mark-ink.svg";
  const childrenLogoPath="assets/bulletin/children-mark.png";
  const assets = [logoPath,inkLogoPath];
  const fields = {brand:"공동체 이름",eventsText:"교회 일정 (주보용)",issue:"호수", church:"교회명", news:"부서 소식", welcome:"환영 문구", notices:"상시 안내", staff:"섬김이 명단",
    motto:"공동체 표어", verse:"표어 성구", website:"웹사이트", address:"주소", meeting:"예배 시간·장소", outline:"설교 요점", leader:"인도자", announcer:"광고 담당", sermonReference:"요약 본문·쪽수", outlineTitle:"요약 표제",monthlyTheme:"이달의 주제",memoryVerse:"새길 말씀",memoryReference:"새길 말씀 출처",readingPlan:"잠잠성경 읽기표"};
  const frameLabels={cross:"십자가",brand:"공동체 이름",eventsMonth:"일정 월",prayersMonth:"위원표 월",insideChurch:"안쪽 교회명",insideBrand:"안쪽 공동체명",eventsTitle:"교회 일정 제목",events:"교회 일정",newsTitle:"부서 소식 제목",monthlyThemeTitle:"이달의 주제 제목",themeMonth:"주제 월",memoryTitle:"새길 말씀 제목",readingTitle:"잠잠성경 제목",readingHelp:"읽기 안내",readingFooter:"확인 안내",liturgical:"교회력 명칭",
    orderTitle:"예배 순서 제목",order:"예배 순서",leader:"인도자",prayersTitle:"예배 위원 제목",prayers:"예배 위원",
    sermon:"설교 제목·본문",notesTitle:"설교 노트 제목",notes:"노트 줄"};
  const frameLabel=id=>fields[id]||frameLabels[id]||id;
  const clean = value => String(value ?? "").trim();
  const snap = (value, step=2.5) => Math.round(value/step)*step;
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateLabel = value => { const [y,m,d]=String(value).split("-").map(Number); return y&&m&&d ? `${y}년 ${m}월 ${d}일` : ""; };
  const shortDate = value => { const [,m,d]=String(value).split("-").map(Number); return m&&d ? `${m}월 ${d}일` : ""; };

  const profileKeys=["brand","church","notices","staff","motto","verse","website","address","meeting","welcome"];
  // Confirmed archive metadata only; never infer a future issue from week numbers.
  const archiveIssues={"2025-01-05":"1","2025-01-12":"2","2025-01-26":"3","2025-02-02":"4","2025-02-09":"5","2025-02-16":"6","2025-02-23":"7","2025-03-09":"8","2025-03-16":"9","2025-03-23":"10","2025-03-30":"11","2025-04-13":"12","2025-04-20":"13","2025-04-27":"14","2025-05-04":"15","2025-05-11":"16","2025-05-18":"17","2025-05-25":"18","2025-06-01":"19","2025-06-15":"20","2025-06-22":"21","2025-06-29":"22","2025-07-20":"23","2025-07-27":"24","2025-08-03":"25","2025-08-10":"26","2025-08-17":"27","2025-08-31":"28","2025-09-07":"29","2025-09-14":"30","2025-09-21":"31","2025-09-28":"32","2025-10-12":"33","2025-10-19":"34","2025-10-26":"35","2025-11-02":"36","2025-11-09":"37","2025-11-16":"38","2025-11-30":"39","2025-12-07":"40","2025-12-14":"41","2025-12-21":"42","2026-01-18":"1","2026-01-25":"2","2026-02-08":"3","2026-02-22":"4","2026-03-08":"5","2026-03-22":"6","2026-03-29":"7","2026-04-12":"8","2026-04-19":"9","2026-04-26":"10","2026-05-10":"11","2026-05-17":"12","2026-05-24":"13","2026-05-31":"14","2026-06-07":"15","2026-06-21":"16","2026-06-28":"17","2026-07-05":"18","2026-07-19":"19","2026-07-26":"20","2026-08-02":"21","2026-08-16":"22","2026-08-23":"23","2026-09-06":"24","2026-09-13":"25","2026-09-20":"26"};
  // Legacy keys decode saved drafts; current choices come from the shared registry.
  const backgroundKey=value=>value===undefined?"auto":themeArtwork[value]||value||"";
  function backgroundFor(doc) {
    const key=backgroundKey(doc.settings?.theme);
    if(key==="auto")return doc.source?.autoBackground||null;
    return (doc.backgrounds||[]).find(item=>item.key===key)
      || (Object.hasOwn(themeArtwork,doc.settings?.theme||"")?{key,url:artworkPath(doc.settings.theme)}:null);
  }
  const validMonth=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v||"");
  function profileForDate(date,department="young-adult") {
    if(department==="children")return {church:"기독교대한성결교회 검단우리교회",website:"gdwoori.org",
      address:`인천광역시 ${date>="2026-07-05"?"검단구":"서구"} 완정로 178번안길 1`,
      welcome:"오늘도 어린이부 예배에 오신 여러분을\n환영하고 축복합니다 :)",meeting:"주일 오전 10:50 · 2층 교육관",
      motto:"말씀이 기준이 되어 하나님이 함께하심으로\n말씀 안에서 사랑을 실천하는 예배자가 되겠습니다",
      verse:"이 예언의 말씀을 읽는 자와 듣는 자와 그 가운데에 기록한 것을 지키는 자는 복이 있나니 때가 가까움이라\n— 요한계시록 1:3",
      notices:"◈ 잠들기 전, 잠언 읽기! 잠잠성경을 매일 읽고 체크해서 선생님들께 확인 받아요!\n◈ 연말에 잠잠성경과 주보 모으기 시상식이 있습니다!",
      staff:"위임목사 김남영 목사 · 담당 교역자 박소영 전도사\n부장 유기숙 권사 · 총무 박지훈 청년"};
    if(!date||date<"2024-11-24")return {};
    const modern=date>="2025-02-02";
    const hour=date>="2026-10-01"?"오전 10시 30분":date>="2026-05-31"?"오후 3시":date>="2025-09-14"?"오전 11시":"오전 10시";
    return {church:"기독교대한성결교회 검단우리교회",website:"gdwoori.org",
      address:`인천광역시 ${date>="2026-07-05"?"검단구":"서구"} 완정로 178번안길 1`,
      welcome:date>="2026-01-18"?"오늘도 청년부 예배에 오신 여러분을\n환영하고 축복합니다 :)":"청년부 예배에 오신 여러분을 환영합니다.",
      meeting:"주일 오후 1:10 · 1층 베데스다홀",
      motto:modern?"말씀으로 인도받는 RIA 청년 공동체":"하나님의 주 되심을 인정하는 청년들",
      verse:modern?'이는 그들을 긍휼히 여기는 이가 그들을 이끌되 샘물 근원으로 인도할 것임이라\n— 이사야 49:10b':'여호와께서 집을 세우지 아니하시면 세우는 자의 수고가 헛되며\n여호와께서 성을 지키지 아니하시면 파수꾼의 깨어 있음이 헛되도다 — 시편 127:1',
      notices:[date>="2025-04-13"?`◈ 청년부 기도 모임(매주 토요일 ${hour} / 1층 청년부실)에 많은 참여 바랍니다.`:"예배 시작 10분 전에 모여 함께 기도로 준비해 주세요.","◈ 검단우리교회는 신천지 추수꾼 및 각종 이단의 출입을 금지합니다."].join("\n"),
      staff:date>="2025-12-07"?"위임목사 김남영 목사 · 담당 교역자 김석범 목사\n회장 김음파 청년 · 총무 이재희 청년\n서기 박지훈 청년 · 회계 서영윤 청년":""};
  }
  function monthlyView(calendar,date,settings={},services=[],department="young-adult") {
    const selectedEventsMonth=validMonth(settings.eventsMonth);
    const eventsMonth=selectedEventsMonth?settings.eventsMonth:date.slice(0,7);
    const rosterMonth=validMonth(settings.rosterMonth)?settings.rosterMonth:date.slice(0,7);
    const [y,m]=rosterMonth.split("-").map(Number),cursor=new Date(Date.UTC(y,m-1,1));
    cursor.setUTCDate(1+(7-cursor.getUTCDay())%7);
    const next=new Date(`${date}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+(7-next.getUTCDay()||7));
    const nextDate=next.toISOString().slice(0,10),prayers=[];
    do {
      const day=cursor.toISOString().slice(0,10),row=calendar.find(r=>r.date===day)||{};
      const exception=services.find(r=>r.date===day&&r.noGathering)||(department!=="children"&&/청년부\s*야외예배/.test(row.church_schedule||"")?{label:"야외예배"}:null);
      prayers.push({date:day,person:exception?`(${exception.label||"집회 없음"})`:clean(row[department==="children"?"children_prayer":"young_adult_prayer"])||"미정",next:day===nextDate});
      cursor.setUTCDate(cursor.getUTCDate()+7);
    } while(prayers[prayers.length-1].date.slice(0,7)===rosterMonth);
    return {eventsMonth,rosterMonth,prayers,events:calendar.filter(r=>r.date.slice(0,7)===eventsMonth&&clean(r.church_schedule))
      .sort((a,b)=>a.date.localeCompare(b.date)).map(r=>`${shortDate(r.date)}  ${clean(r.church_schedule)}`).join("\n")};
  }

  // Monthly panels transcribed from all 26 youth bulletins in 2026.
  const archiveMonthlyEvents = [
  {
    "date": "2026-01-18",
    "events": "2일 (금) 오후 8:00 | 월삭예배\n18일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-02-08",
    "events": "6일 (금) 오후 8:00 | 월삭예배\n22일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-03-08",
    "events": "6일 (금) 오후 8:00 | 월삭예배\n22일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-04-12",
    "events": "3일 (금) 오후 8:00 | 월삭예배\n19일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-05-10",
    "events": "1일 (금) – 22일 (금) 평일 오후 8:00 | 오멜세기기도회\n1일 (금) 오후 8:00 | 월삭예배\n17일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-06-07",
    "events": "5일 (금) 오후 8:00 | 월삭예배\n21일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-07-05",
    "events": "3일 (금) 오후 8:00 | 월삭예배\n19일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-08-02",
    "events": "7일 (금) 오후 8:00 | 온세대 월삭예배\n23일 (주일) 오전 10:50 | 온세대 찬양예배"
  },
  {
    "date": "2026-09-06",
    "events": "4일 (금) 오후 8:00 | 온세대 월삭예배\n20일 (주일) 오전 10:50 | 온세대 찬양예배"
  }
];

  // Reuse only explicitly shared content, never last week's worship or news.
  function reusableContent(date,month,history=[],department="young-adult") {
    const common=profileForDate(date,department),commonOverrides={};
    let events=department==="children"?undefined:archiveMonthlyEvents.filter(row=>row.date<=date&&row.date.slice(0,7)===month).at(-1)?.events;
    let eventsOrigin=events!==undefined?"실주보 월간 일정":"교회력 일정";
    const rows=history.filter(row=>row.date<=date).slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.id||"").localeCompare(String(b.id||"")));
    for(const row of rows) {
      const shared=row.content?.reuse?.common||row.content?.fields;
      for(const key of profileKeys)if(typeof shared?.[key]==="string")common[key]=commonOverrides[key]=shared[key];
      const legacyMonth=row.content?.eventsMonth||row.date.slice(0,7);
      const value=row.content?.reuse?.months?.[month]??(!row.content?.reuse&&legacyMonth===month?row.content?.fields?.eventsText:undefined);
      if(typeof value==="string"){events=value;eventsOrigin="같은 달에 저장한 일정";}
    }
    return {common,commonOverrides,events,eventsOrigin};
  }

  // The printed archive separates the welcome, weekly news and recurring notices.
  // Only recognize explicit paragraphs; unknown wording stays in the news field.
  function announcementParts(raw) {
    const parts={news:[],welcome:[],notices:[]};
    for(const paragraph of raw.split(/\n(?=\s*(?:\*\*)?(?:\d+[.)]|[①-⑳◈◇◆])\s*)|\n\s*\n/)) {
      const lines=paragraph.trim().split("\n");
      if(/^오늘도 (?:청년부|청소년부|어린이부) 예배에 오신 여러분을/.test(window.MindexInlineText.plain(lines[0]))&&/환영.*축복/.test(window.MindexInlineText.plain(lines[0])))parts.welcome.push(lines.shift());
      const text=lines.join("\n").trim();if(!text)continue;
      let skip=window.MindexInlineText.plain(text).match(/^(?:\d+[.)]|[①-⑳◈◇◆])\s*/)?.[0].length||0;
      const body=window.MindexInlineText.runs(text).map(run=>{
        const value=run.text.slice(skip);skip=Math.max(0,skip-run.text.length);
        return value&&run.bold?`**${value}**`:value;
      }).join("");
      const plainBody=window.MindexInlineText.plain(body);
      if(/^(?:청년부\s*기도 모임\s*\(매주|검단우리교회는 신천지|잠들기 전, 잠언 읽기!|연말에 잠잠성경과 주보 모으기)/.test(plainBody))parts.notices.push(`◈ ${body}`);
      else parts.news.push(text);
    }
    return Object.fromEntries(Object.entries(parts).map(([key,lines])=>[key,lines.join("\n")]));
  }

  // Exact printed issue metadata; never extend weekly copy to another date.
  const archiveReference={
  "2026-07-05": {
    "leader": "서영윤 청년",
    "announcer": "박지훈 서기",
    "outline": "① 구원의 틈\n② 시간의 틈\n③ 물질의 틈",
    "sermonReference": "행 24:24–27 (신약 p. 231)",
    "roster": [
      "김음파 청년",
      "(연합예배)",
      "김유리 청년",
      "김윤민 청년",
      "김윤서 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "말씀 요약",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 다음 주 청년부 예배는 교육사역부 제자헌신예배 관계로,\n오후예배(3층 본당)로 연합하여 드립니다.\n③ 청년부 여름 수련회 – 안흥교회 여름성경학교 공지합니다.\n일시: 8월 2일(주일)–5일(수)\n장소: 충남 태안 안흥교회\n교재: 파이디온선교회 '신나는 성경탐험 구약'"
  },
  "2026-07-19": {
    "leader": "서영윤 청년",
    "announcer": "박지훈 서기",
    "outline": "① 신뢰하는 믿음\n② 때를 기다리는 믿음",
    "sermonReference": "행 27:22–26 (신약 p. 236)",
    "roster": [
      "김음파 청년",
      "(연합예배)",
      "김유리 청년",
      "김윤민 청년",
      "김윤서 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "말씀 요약",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 청년부 여름 수련회 – 안흥교회 여름성경학교 공지합니다.\n일시: 8월 2일(주일)–5일(수)\n장소: 충남 태안 안흥교회\n교재: 파이디온선교회 '신나는 성경탐험 구약'"
  },
  "2026-07-26": {
    "leader": "서영윤 청년",
    "announcer": "박지훈 서기",
    "outline": "",
    "sermonReference": "행 28:30–31 (신약 p. 238)",
    "roster": [
      "김음파 청년",
      "(연합예배)",
      "김유리 청년",
      "김윤민 청년",
      "김윤서 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 청년부 여름 수련회 – 안흥교회 여름성경학교가 일주일 후 시작됩니다!\n일시: 8월 2일(주일)–5일(수)\n장소: 충남 태안 안흥교회\n교재: 파이디온선교회 '신나는 성경탐험 구약'"
  },
  "2026-08-02": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 순종하는 믿음\n② 성령의 음성에 귀 기울이는 믿음\n③ 은밀한 믿음\n④ 넓게 여는 믿음",
    "sermonReference": "왕하 4:1–7",
    "roster": [
      "김윤서 청년",
      "김하은 청년",
      "박지훈 청년",
      "서영윤 청년",
      "이재희 청년",
      "이지원 청년"
    ],
    "outlineColumns": 2,
    "outlineTitle": "",
    "news": "① 청년부 여름 수련회 – 안흥교회 여름성경학교가 오늘 시작됩니다!\n일시: 8월 2일(주일)–5일(수)\n장소: 충남 태안 안흥교회\n교재: 파이디온선교회 '신나는 성경탐험 구약'\n② 돌아오는 금요일(7일) 저녁에 온세대 월삭예배가 있습니다."
  },
  "2026-08-16": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 내면의 강함\n② 형통",
    "sermonReference": "삼상 16:6–13",
    "roster": [
      "김윤서 청년",
      "(연합예배)",
      "김하은 청년",
      "박지훈 청년",
      "서영윤 청년",
      "이재희 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 교회에서 진행 중인 '업둥이 전도'에 청년들도 많은 신청과 참여 바랍니다!"
  },
  "2026-08-23": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 교회의 기도\n② 지속적 기도\n③ 간절한 기도",
    "sermonReference": "행 12:1–5",
    "roster": [
      "김윤서 청년",
      "(연합예배)",
      "김하은 청년",
      "박지훈 청년",
      "(야외예배)",
      "서영윤 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 다음 주 청년부 예배는 '야외예배'로 드립니다.\n- 일시: 8월 30일 주일 오후 1시 (교회 차량으로 이동)\n- 장소: 더현대 서울 (서울특별시 영등포구)"
  },
  "2026-09-06": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 누구와 함께 있는가?\n② 어디에 있는가?",
    "sermonReference": "삼상 18:27–30",
    "roster": [
      "서영윤 청년",
      "이재희 청년",
      "이지원 청년",
      "김음파 청년",
      "김윤민 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다."
  },
  "2026-09-13": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 무리수\n② 주님이 아십니다",
    "sermonReference": "삼상 21:10–15",
    "roster": [
      "서영윤 청년",
      "이재희 청년",
      "이지원 청년",
      "김음파 청년",
      "김윤민 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다."
  },
  "2026-09-20": {
    "leader": "이재희 청년",
    "announcer": "박지훈 서기",
    "outline": "① 길을 잃다\n② 다시 길을 찾다",
    "sermonReference": "삼상 22:1–5",
    "roster": [
      "서영윤 청년",
      "이재희 청년",
      "이지원 청년",
      "김음파 청년",
      "김윤민 청년"
    ],
    "outlineColumns": 1,
    "outlineTitle": "",
    "news": "① 오늘 2부 활동은 셀 모임으로 진행합니다.\n② 추석 이후, 다음 주일부터 셀 구성이 개편됩니다."
  }
};
  const inkLayout=date=>date>="2026-07-05"&&date<"2026-09-06";
  function resolveSource({service, sections=[], elements=[], songs=[], scriptures=[], calendar=[], settings={}, services=[], history=[]}) {
    const compactOrder=settings.compactOrder!==false;
    const songById = new Map(songs.map(s=>[s.id,s]));
    const scriptureById = new Map(scriptures.map(s=>[s.id,s]));
    const sectionById = new Map(sections.map(s=>[s.id,s]));
    const date = service.service_date;
    const department=service.service_type_id==="children"?"children":"young-adult";
    const today = calendar.find(r=>r.date===date) || {};
    const source = {id:service.id, date, department, leader:clean(service.worship_leader), liturgical:[clean(today.liturgical),clean(today.note)].filter(Boolean).join(" / "),
      sermon:"", scripture:"", news:"", order:[], prayers:[], events:"", loadedAt:new Date().toISOString()};
    const hasReading=elements.some(e=>sectionById.get(e.section_id)?.section_key==="scripture_reading");
    const ordered = elements.filter(e=>sectionById.has(e.section_id)).sort((a,b)=>
      (sectionById.get(a.section_id).sort_order-sectionById.get(b.section_id).sort_order) || (a.sort_order-b.sort_order));
    for (const el of ordered) {
      const section=sectionById.get(el.section_id), config=el.config||{}, ref=el.source_ref||{};
      const type=config.elementType||config.element_type||el.element_type;
      let slot=clean(ref.slotKey||config.slotKey);
      let label=clean(ref.label||section.title);
      if(!slot&&section.section_key==="sermon")slot=({"설교 제목":"sermon.title","설교 본문":"sermon.scripture","인용 구절":"sermon.citation"})[label]||"";
      if(compactOrder&&section.section_key==="prayer"&&label==="기도")label="대표기도";
      if(compactOrder&&section.section_key==="announcements"&&type==="title"&&!clean(el.title)&&!clean(el.body))continue;
      if ((compactOrder && (/^(ready|preparation|closing|fellowship)(\.|$)/.test(slot) || /^sermon\.citation(?:\.|$)/.test(slot)
        || /^(ready|preparation|closing|fellowship)$/.test(section.section_key)
        || /^(준비|폐회|실시간 성구 송출)$/.test(label)))
        || ["blank","image","video","audio","file","ppt","pdf","live_scripture"].includes(type)
        || config.templateSuppressed || el.content_state?.status==="suppressed" || el.content_state?.state==="suppressed") continue;
      if(compactOrder)label=label.replace(/^(찬양|찬송)\s*\d+(?:\s*[–~-]\s*\d+)?$/, "$1");
      const linked = songById.get(el.song_id);
      const scripture = scriptureById.get(el.scripture_id);
      let content = linked ? [linked.hymn_no,linked.title].filter(Boolean).join(" ")
        : clean(["body","plain_text","editable"].includes(type)?el.body||el.title:el.title);
      const reference = clean(el.scripture_reference||config.scriptureReference||config.scripture_reference||(Array.isArray(config.scriptureReferences)?config.scriptureReferences.map(clean).filter(Boolean).join(" / "):"")||scripture?.reference);
      if(slot==="sermon.scripture") {if(reference)source.scripture=reference;if(hasReading&&compactOrder)continue;}
      if (reference && /scripture|성경|본문/.test([type,slot,label].join(" "))) {
        content=reference;
        if (!source.scripture&&!/^sermon\.citation(?:\.|$)/.test(slot)) source.scripture=reference;
        if(compactOrder)label="성경봉독";
      }
      if (slot==="sermon.title" || label==="설교") {source.sermon=content;label="설교";}
      if (/announcements/.test(section.section_key) && ["body","plain_text","editable"].includes(type)) {
        source.news=[source.news,clean(el.body||el.title)].filter(Boolean).join("\n");
        source.order.push({id:el.id,label:"광고",content:"",person:clean(el.person)});
        continue;
      }
      let person=clean(el.person);
      if (label.replace(/\s/g,"")==="대표기도"||(department==="children"&&label.replace(/\s/g,"")==="봉헌기도")) person=clean(today[department==="children"?"children_prayer":"young_adult_prayer"])||person;
      if(compactOrder&&!person&&["사도신경","찬양","찬송","기도","성경봉독","결단찬양","결단기도","봉헌찬양","봉헌","파송찬양"].includes(label))person="다같이";
      if (content===label||(compactOrder&&["title_person","title_assignee"].includes(type)&&content===person)) content="";
      if(compactOrder&&["사도신경","주기도문","공동체 고백"].includes(label))content="";
      const last=source.order[source.order.length-1];
      if (compactOrder && last && last.label===label && last.person===person && content) last.content=[last.content,content].filter(Boolean).join("\n");
      else source.order.push({id:el.id,label,content,person});
    }
    source.announcements=source.news;
    Object.assign(source,announcementParts(source.news));
    Object.assign(source,monthlyView(calendar,date,settings,services,department));
    const reused=reusableContent(date,source.eventsMonth,history,department);
    source.common=reused.common;source.commonOverrides=reused.commonOverrides;
    source.calendarEvents=source.events;
    if(reused.events!==undefined){source.events=reused.events;source.eventsOrigin=reused.eventsOrigin;}
    else source.eventsOrigin="교회력 일정";
    const archived=["young_adult","young-adult"].includes(service.service_type_id)?archiveReference[date]:null;
    const reference=settings.archiveReference!==false?archived:null;
    source.hasArchiveReference=!!archived;
    source.archiveReference=!!reference;
    source.announcer=source.order.find(r=>r.label==="광고")?.person||"";
    if(reference){
      for(const key of ["outline","sermonReference","outlineTitle","outlineColumns"])source[key]=reference[key];
      if(!source.leader)source.leader=reference.leader;
      if(!source.announcer)source.announcer=reference.announcer;
      if(source.rosterMonth===date.slice(0,7))source.prayers=source.prayers.map((r,i)=>({...r,person:reference.roster[i]||r.person}));
    }
    // All reviewed 2026 youth issues include prayer between praise and the reading.
    const printPrayer=["young_adult","young-adult"].includes(service.service_type_id)&&date>="2026-01-18";
    const suppressedPrayer=ordered.some(e=>sectionById.get(e.section_id)?.section_key==="praise"&&clean(e.source_ref?.label)==="기도"&&(e.config?.templateSuppressed||e.content_state?.state==="suppressed"||e.content_state?.status==="suppressed"));
    if(compactOrder&&printPrayer&&!suppressedPrayer){
      const lastPraise=source.order.findLastIndex(r=>["찬양","찬송"].includes(r.label));
      if(lastPraise>=0&&source.order[lastPraise+1]?.label==="성경봉독")source.order.splice(lastPraise+1,0,{id:"bulletin-communal-prayer",label:"기도",content:"",person:"다같이"});
    }
    if(department==="children"){
      source.curriculumMonth=date.slice(0,7);
      source.monthlyTheme=({"2026-09":"문화\n빛의 자녀다운 생활\n우리는 세상의 빛","2026-10":"사회질서\n사회질서를 지켜요\n말씀에 따라 사회의 규범을 지켜요"})[date.slice(0,7)]||"";
      for(const row of history.filter(r=>r.date<=date&&r.date.slice(0,7)===date.slice(0,7)).sort((a,b)=>a.date.localeCompare(b.date)))if(typeof row.content?.fields?.monthlyTheme==="string")source.monthlyTheme=row.content.fields.monthlyTheme;
      source.memoryVerse=date==="2026-10-04"?"너희가 이방인 중에서 행실을 선하게 가져\n너희를 악행한다고 비방하는 자들로 하여금\n너희 선한 일을 보고 오시는 날에\n하나님께 영광을 돌리게 하려 함이라":"";
      source.memoryReference=date==="2026-10-04"?"베드로전서 2:12":"";
      source.readingPlan="";
      if(date>="2026-08-30"){
        let days=7;
        while(days<28&&services.some(r=>r.noGathering&&r.date===new Date(Date.parse(date+"T00:00:00Z")+days*86400000).toISOString().slice(0,10)))days+=7;
        source.readingPlan=Array.from({length:days},(_,i)=>{
          const day=new Date(Date.parse(date+"T00:00:00Z")+i*86400000),elapsed=Math.round((day-Date.parse("2026-10-04T00:00:00Z"))/86400000);
          return `${shortDate(day.toISOString().slice(0,10))} (${"일월화수목금토"[day.getUTCDay()]}) · 잠언 ${((15+elapsed)%31+31)%31+1}장`;
        }).join("\n");
      }
      if(date==="2026-10-04")source.issue="29";
    }
    return source;
  }

  function defaultFrames(design) {
    if(design==="simple")return simpleFrames();
    if(design==="children")return childrenFrames();
    if(design==="editorial")return editorialFrames();
    const frames=[];
    const text=(id,page,x,y,w,h,size,binding,align="left",weight=500)=>frames.push({id,page,x,y,w,h,size,binding,align,weight,type:"text"});
    text("eventsTitle",0,10,20,90,10,17.5,"label:교회 일정","left",700);
    text("eventsMonth",0,108.5,20,30,12.5,10,"month:eventsMonth","right");
    frames.push({id:"events",page:0,x:10,y:35,w:128.5,h:42.5,size:12.5,type:"events",binding:"field:eventsText"});
    text("newsTitle",0,10,77.5,128.5,10,17.5,"label:청년부 소식","left",700);
    text("welcome",0,10,90,128.5,12.5,12.5,"field:welcome","left");
    frames.push({id:"news",page:0,x:10,y:102.5,w:128.5,h:42.5,size:12.5,type:"list",binding:"field:news"});
    frames.push({id:"notices",page:0,x:10,y:145,w:128.5,h:17.5,size:12.5,type:"list",binding:"field:notices"});
    frames.push({id:"staff",page:0,x:10,y:170,w:128.5,h:25,size:10,type:"staff",binding:"field:staff"});
    text("church",0,158.5,20,128.5,12.5,20,"field:church","center",700);
    text("liturgical",0,158.5,30,128.5,15,15,"source:liturgical","center",500);
    text("motto",0,158.5,170,128.5,10,20,"field:motto","center",700);
    text("verse",0,158.5,180,128.5,15,12.5,"field:verse","center");
    text("website",0,10,2.5,128.5,5,10,"field:website");
    text("issue",0,158.5,2.5,128.5,5,10,"issue","right");
    text("address",0,10,202.5,128.5,5,10,"field:address");
    text("meeting",0,158.5,202.5,128.5,5,10,"field:meeting","right");
    text("orderTitle",1,10,20,75,10,17.5,"label:예배 순서","left",700);
    text("leader",1,108.5,20,30,12.5,10,"leader","right");
    frames.push({id:"order",page:1,x:10,y:37.5,w:128.5,h:150,size:12.5,type:"order",binding:"source:order"});
    text("prayersTitle",1,158.5,20,90,10,17.5,"label:예배 위원","left",700);
    text("prayersMonth",1,257,20,30,12.5,10,"month:rosterMonth","right");
    frames.push({id:"prayers",page:1,x:158.5,y:35,w:128.5,h:35,size:12.5,type:"prayers",binding:"source:prayers"});
    text("sermon",1,158.5,85,128.5,17.5,12.5,"sermon","right",700);
    frames.push({id:"outline",page:1,x:158.5,y:100,w:128.5,h:35,size:12.5,type:"list",binding:"field:outline"});
    text("notesTitle",1,158.5,142.5,128.5,10,17.5,"label:설교 노트","left",700);
    frames.push({id:"notes",page:1,x:158.5,y:160,w:128.5,h:30,size:10,type:"rules",binding:""});
    text("insideChurch",1,10,2.5,128.5,5,10,"field:church");
    text("insideBrand",1,158.5,202.5,128.5,5,10,"label:RIA 청년부","right");
    return frames;
  }

  function legacyChildrenFrames(){
    const frames=defaultFrames().filter(f=>!["prayersTitle","prayersMonth","prayers","sermon","outline","notesTitle","notes"].includes(f.id));
    for(const f of frames){
      if(f.id==="newsTitle")f.binding="label:어린이부 소식";
      if(f.id==="insideBrand")f.binding="label:꿈꾸는 어린이부";
      if(f.id==="leader")Object.assign(f,{x:85,w:53.5});
      if(f.id==="motto")Object.assign(f,{y:167.5,h:15,size:12.5});
      if(f.id==="verse")Object.assign(f,{y:185,h:12.5,size:10});
    }
    const add=(id,x,y,w,h,size,binding,type="text",align="left",weight=500)=>frames.push({id,page:1,x,y,w,h,size,binding,type,align,weight});
    add("monthlyThemeTitle",158.5,20,90,10,17.5,"label:이달의 주제","text","left",700);
    add("themeMonth",257,20,30,12.5,10,"month:curriculumMonth","text","right");
    add("monthlyTheme",158.5,35,128.5,30,15,"field:monthlyTheme","text","center",700);
    add("memoryTitle",158.5,72.5,60,10,17.5,"label:새길 말씀","text","left",700);
    add("memoryReference",221,72.5,66,12.5,10,"field:memoryReference","text","right");
    add("memoryVerse",158.5,87.5,128.5,35,12.5,"field:memoryVerse");
    add("readingTitle",158.5,127.5,75,10,17.5,"label:잠잠성경","text","left",700);
    add("readingHelp",233.5,127.5,53.5,10,10,"label:잠들기 전, 잠언 읽기!","text","right");
    add("readingPlan",158.5,142.5,128.5,52.5,10,"field:readingPlan","reading");
    add("readingFooter",158.5,195,128.5,7.5,10,"label:부모님께 확인받고, 선생님께 달란트 받자!","text","right");
    return frames;
  }

  // Measured from the issued children's bulletin, 2026-10-04 (A4 landscape).
  function childrenFrames(){
    const frames=legacyChildrenFrames();
    const changes={
      verse:{y:180},order:{h:145},
      memoryTitle:{y:62.5},memoryReference:{y:62.5,size:12.5},memoryVerse:{y:75},
      readingPlan:{y:140,h:55,size:12.5},readingFooter:{y:180,h:12.5,size:12.5},
      website:{x:8.5},address:{x:8.5},insideChurch:{x:8.5},
    };
    for(const f of frames)Object.assign(f,changes[f.id]||{});
    return frames;
  }

  function editorialFrames() {
    const positions={
      newsTitle:[0,10,15,128.5,10,20],news:[0,10,30,128.5,47.5,12.5],
      eventsTitle:[0,10,85,90,10,15],eventsMonth:[0,108.5,85,30,10,10],events:[0,10,97.5,128.5,35,10],
      notices:[0,10,137.5,128.5,20,10],prayersTitle:[0,10,162.5,90,7.5,12.5],prayersMonth:[0,108.5,162.5,30,7.5,10],prayers:[0,10,172.5,128.5,22.5,10],
      website:[0,10,200,60,5,7.5],address:[0,70,200,68.5,5,7.5],
      church:[0,158.5,15,128.5,7.5,12.5],issue:[0,158.5,27.5,128.5,7.5,12.5],liturgical:[0,158.5,70,128.5,7.5,10],
      motto:[0,158.5,145,128.5,15,22.5],verse:[0,158.5,165,128.5,17.5,12.5],welcome:[0,158.5,185,128.5,12.5,12.5],meeting:[0,158.5,200,128.5,5,10],
      orderTitle:[1,10,15,128.5,12.5,20],leader:[1,10,30,128.5,7.5,10],order:[1,10,40,128.5,137.5,12.5],staff:[1,10,182.5,128.5,17.5,10],insideChurch:[1,10,202.5,128.5,5,7.5],
      notesTitle:[1,158.5,15,128.5,12.5,20],sermon:[1,158.5,35,128.5,35,25],outline:[1,158.5,77.5,128.5,35,12.5],notes:[1,158.5,122.5,128.5,72.5,10],insideBrand:[1,158.5,202.5,128.5,5,7.5]
    };
    return defaultFrames().map(frame=>{
      const [page,x,y,w,h,size]=positions[frame.id];
      return {...frame,page,x,y,w,h,size,align:["address","eventsMonth","prayersMonth","insideBrand"].includes(frame.id)?"right":"left",
        ...(frame.id==="newsTitle"?{binding:"label:우리의 한 주"}:{}),...(frame.id==="notesTitle"?{binding:"label:말씀과 기록"}:{})};
    });
  }

  // Flow positions are derived for preview/print only; stored frames remain reusable.
  function simpleFrames() {
    const positions={
      newsTitle:[0,10,15,128.5,10,20],news:[0,10,30,128.5,50,11.5],
      notices:[0,10,85,128.5,20,10],eventsTitle:[0,10,110,90,7.5,12.5],eventsMonth:[0,108.5,110,30,7.5,10],events:[0,10,120,128.5,20,10],
      staff:[0,10,165,128.5,25,9],
      church:[0,158.5,12.5,128.5,7.5,10],issue:[0,158.5,23,128.5,7.5,10],
      motto:[0,158.5,37,128.5,12.5,11.5],welcome:[0,158.5,88,128.5,20,12.5],verse:[0,158.5,147,128.5,30,12.5],liturgical:[0,158.5,185,128.5,7.5,9],meeting:[0,158.5,200,128.5,5,8],
      order:[1,10,37.5,128.5,157.5,11],leader:[1,10,29,128.5,7.5,10],
      sermon:[1,158.5,35,128.5,28,25],outline:[1,158.5,70,128.5,40,11.5],notes:[1,158.5,115,128.5,80,10]
    };
    return editorialFrames().map(f=>{
      const p=positions[f.id];
      return {...f,...(p?Object.fromEntries(['page','x','y','w','h','size'].map((k,i)=>[k,p[i]])):{}),
        ...(f.id==='newsTitle'?{binding:'label:청년부 소식'}:{}),
        ...(['prayersTitle','prayersMonth','prayers'].includes(f.id)?{hidden:true}:{})};
    }).concat([{id:'brand',page:0,x:158.5,y:51,w:128.5,h:34,size:40,type:'text',binding:'field:brand',weight:700,align:'left'},{id:'cross',page:0,x:216.25,y:116,w:13,h:23,size:10,type:'cross',binding:'',align:'left'}]);
  }
  function isFlowFrame(doc,id) {return doc.settings?.design==="simple"&&["news","notices","eventsTitle","eventsMonth","events","staff","outline","notes"].includes(id);}
  function simpleFlow(doc) {
    const frames=clone(doc.frames),get=id=>frames.find(f=>f.id===id);
    const height=f=>{
      if(!f||f.hidden)return 0;
      const value=boundText(doc,f);if(!String(value||'').trim()&&!(f.id==='outline'&&fieldValue(doc,'outlineTitle')))return 0;
      const g=svg('g'),check=new Set(),box={...f,h:10000,weight:/Title$/.test(f.id)?700:500,leading:f.size*(doc.settings.lineHeight||1.55),itemGap:doc.settings.itemGap??3.5};
      if(f.type==='list')return renderEditorialList(g,value,box,check,doc);
      if(f.type==='events')return renderEditorialEvents(g,value,box,check);
      return writeText(g,value,box,check,f.id);
    };
    let y=get('news').y;
    for(const id of ['news','notices','eventsTitle','events','staff']){
      const f=get(id);if(!f)continue;
      f.y=y;const h=height(f);f.h=Math.max(.1,h+2);
      if(id==='eventsTitle'){const month=get('eventsMonth');month.y=y;month.h=f.h;}
      if(h)y+=f.h+(id==='news'?4:2.5);
    }
    const outline=get('outline'),notes=get('notes');
    if(outline&&notes){outline.h=Math.max(.1,height(outline));notes.y=outline.y+outline.h+5;notes.h=Math.max(.1,195-notes.y);}
    return {...doc,frames};
  }

  // Measure and paint through the same path, at the actual baseline origin.
  function renderEditorialEvents(group,value,box,issues,muted="#69746E") {
    let y=box.y;
    for(const text of String(value||"").split("\n").filter(Boolean)){
      const parts=text.split(/ \| |\s{2,}/),date=parts.length>1?parts.shift():"",body=parts.join(" ")||text;
      if(box.w<=72.5){issues.add(box.id);break;}
      if(!box.leading){
        const h=Math.max(7.5,Math.max(wrap(date,57.5,box.size).length,wrap(body,date?box.w-62.5:box.w,box.size,700).length)*snap(box.size*1.3)/MM+1.5);
        if(date)writeText(group,date,{...box,y,w:57.5,h,color:muted},issues,box.id);
        writeText(group,body,{...box,x:date?box.x+62.5:box.x,y,w:date?box.w-62.5:box.w,h,weight:700},issues,box.id);
        y+=h;if(y>box.y+box.h+.01)issues.add(box.id);
        continue;
      }
      const row={...box,y,h:10000};
      const dateHeight=date?writeText(group,date,{...row,w:57.5,color:muted},issues,box.id):0;
      const bodyHeight=writeText(group,body,{...row,x:date?box.x+62.5:box.x,w:date?box.w-62.5:box.w,weight:700},issues,box.id);
      y+=Math.max(7.5,Math.max(dateHeight,bodyHeight)+1.5);
      if(y>box.y+box.h+.01)issues.add(box.id);
    }
    return y-box.y;
  }
  function renderEditorialList(group,value,box,issues,doc) {
    const title=box.id==="outline"?fieldValue(doc,"outlineTitle"):"";
    const offset=title?writeText(group,title,{...box,weight:700},issues,box.id)+2.5:0;
    return offset+renderList(group,value,{...box,y:box.y+offset,h:box.h-offset},issues,
      box.id==="outline"?(doc.settings.outlineColumns||doc.source?.outlineColumns||1):1);
  }

  function renderEditorial(doc,mode,selected) {
    const simple=doc.settings?.design==="simple";
    const pages=[],issues=new Set(),ink="#234C43",muted="#69746E",line="#DCE2DD";
    for(let page=0;page<2;page++){
      const root=svg("svg",{viewBox:"0 0 297 210",class:"bulletin-sheet",role:"img","aria-label":page?"예배 순서 · 말씀과 기록":"우리의 한 주 · 표지"});
      root.append(svg("rect",{width:297,height:210,fill:"#fff"}));
      for(const x of (simple?[]:[10,158.5]))root.append(svg("rect",{x,y:10,width:12.5,height:1,fill:ink}));
      if(!page&&simple){
        root.append(svg('line',{x1:158.5,y1:21,x2:287,y2:21,stroke:ink,'stroke-width':.2}));

      }
      if(!page&&!simple){
        const background=backgroundFor(doc);
        if(background){
          const clip=svg("clipPath",{id:"bulletin-cover-art"});clip.append(svg("rect",{x:158.5,y:85,width:128.5,height:47.5}));
          const defs=svg("defs");defs.append(clip);root.append(defs);
          root.append(svg("image",{href:new URL(background.url,document.baseURI).href,x:158.5,y:85,width:128.5,height:47.5,preserveAspectRatio:"xMidYMid slice","clip-path":"url(#bulletin-cover-art)"}));
        }else root.append(svg("rect",{x:158.5,y:85,width:128.5,height:47.5,fill:"#EDF2EC"}));
        writeText(root,"RIA",{x:158.5,y:42.5,w:70,h:22.5,size:45,weight:800,color:ink},issues,"church");
        writeText(root,"청년부",{x:248.5,y:52.5,w:38.5,h:10,size:17.5,weight:700,align:"right",color:ink},issues,"church");
      }
      for(const f of doc.frames.filter(f=>f.page===page&&(!f.hidden||mode==="layout"))){
        const group=svg("g",{"data-frame-id":f.id}),check=f.hidden?new Set():issues;
        const box={...f,color:simple?"#272C29":ink,...(simple?{weight:/Title$/.test(f.id)?700:500,leading:f.size*(doc.settings.lineHeight||1.55),itemGap:doc.settings.itemGap??3.5}:{})},value=boundText(doc,f);
        if(simple&&!f.hidden&&f.y+f.h>198&&!["website","address","meeting","insideChurch","insideBrand"].includes(f.id))check.add(f.id);
        if(simple&&["notices","eventsTitle","staff","sermon"].includes(f.id)&&String(value).trim())group.append(svg("line",{x1:f.x,y1:f.y-2,x2:f.x+f.w,y2:f.y-2,stroke:line,"stroke-width":.2}));
        if(f.type==="cross")group.append(svg('path',{d:`M${f.x+f.w/2} ${f.y}v${f.h} M${f.x} ${f.y+f.h*.3}h${f.w}`,stroke:ink,'stroke-width':.25,fill:'none'}));
        else if(f.id==="brand")writeText(group,value,{...box,leading:f.size*1.08,weight:700,color:ink},check,f.id);
        else if(f.type==="rules"){
          for(let y=0;y<=f.h;y+=(simple?10:7.5))group.append(svg("line",{x1:f.x,y1:f.y+y,x2:f.x+f.w,y2:f.y+y,stroke:line,"stroke-width":.2}));
        }else if(f.type==="order"){
          let y=f.y;
          for(const row of doc.source?.order||[]){
            const person=personText(row.label==="광고"?fieldValue(doc,"announcer"):row.person);
            const widths=[25,f.w-55,25],texts=[row.label,row.content,person];
            if(widths[1]<15){check.add(f.id);break;}
            const leading=simple?f.size*(doc.settings.lineHeight||1.55):snap(f.size*1.3),count=Math.max(...texts.map((t,i)=>wrap(t,widths[i],f.size,i===1?700:500).length));
            const h=Math.max(simple?10:7.5,count*leading/MM+(simple?(doc.settings.orderPadding??3):2.5));
            texts.forEach((text,i)=>writeText(group,text,{...box,x:f.x+[0,27.5,f.w-25][i],y,w:widths[i],h,leading,weight:simple?(i===0||row.label==="설교"?700:500):i===1?700:500,align:i===2?"right":"left",color:simple?(i===2?muted:"#272C29"):i===1?"#222E29":muted},check,f.id));
            if(simple)group.append(svg("line",{x1:f.x,y1:y+h,x2:f.x+f.w,y2:y+h,stroke:line,"stroke-width":.15}));
            y+=h;if(y>f.y+f.h+.01)check.add(f.id);
          }
        }else if(f.type==="prayers"){
          const list=doc.source?.prayers||[],rows=Math.ceil(list.length/2),col=(f.w-7.5)/2;
          if(col<45)check.add(f.id);
          else list.forEach((row,i)=>{
            const x=f.x+Math.floor(i/rows)*(col+7.5),y=f.y+(i%rows)*7.5;
            if(row.next)group.append(svg("rect",{x:x-1,y,width:col+2,height:7.5,fill:"#EDF2EC"}));
            const personOffset=row.next?35:27.5;
            writeText(group,shortDate(row.date),{...box,x,y,w:row.next?20:27.5,h:7.5,size:f.size,color:muted},check,f.id);
            if(row.next)writeText(group,"다음 주",{...box,x:x+20,y,w:12.5,h:7.5,size:10,weight:700},check,f.id);
            writeText(group,personText(row.person),{...box,x:x+personOffset,y,w:col-personOffset,h:7.5,align:"right",weight:row.next?700:500},check,f.id);
            if(y+7.5>f.y+f.h+.01)check.add(f.id);
          });
        }else if(f.type==="events"){
          renderEditorialEvents(group,value,box,check,muted);
        }else if(f.type==="list"){
          renderEditorialList(group,value,{...box,color:f.id==="notices"?muted:"#222E29"},check,doc);
        }
        else if(f.id==="sermon"){
          const h=writeText(group,doc.source?.sermon||"",{...box,h:f.h-10,weight:700},check,f.id);
          writeText(group,Object.hasOwn(doc.fields,"sermonReference")?fieldValue(doc,"sermonReference"):fieldValue(doc,"sermonReference")||doc.source?.scripture||"",{...box,y:f.y+h+2.5,h:f.h-h-2.5,size:12.5,color:muted},check,f.id);
        }else if(f.id==="leader")writeText(group,fieldValue(doc,"leader")?`인도  ${personText(fieldValue(doc,"leader"))}`:"",box,check,f.id);
        else if(f.binding.startsWith("month:"))writeText(group,(doc.source?.[f.binding.split(":")[1]]||"").replace(/^(\d+)-(\d+)$/,(_,y,m)=>`${Number(m)}월`),box,check,f.id);
        else if(f.id==="welcome")writeStyled(group,copyRuns(value,"welcome",f.size),box,check,f.id);
        else writeText(group,value,{...box,color:["address","website","staff","insideBrand","insideChurch","meeting","notices"].includes(f.id)?muted:simple?"#272C29":ink},check,f.id);
        if(mode==="layout"){
          group.append(svg("rect",{x:f.x,y:f.y,width:f.w,height:f.h,fill:"transparent",stroke:selected===f.id?ink:line,"stroke-width":.25,"data-frame-hit":f.id,class:"bulletin-frame-hit"}));
          if(selected===f.id)group.append(svg("rect",{x:f.x+f.w-1.5,y:f.y+f.h-1.5,width:3,height:3,fill:ink,"data-resize":f.id,class:"bulletin-resize"}));
        }
        root.append(group);
      }
      pages.push(root);
    }
    return {pages,issues};
  }

  function svg(tag, attrs={}, value) {
    const node=document.createElementNS(SVG,tag);
    for (const [key,val] of Object.entries(attrs)) node.setAttribute(key,String(val));
    if (value!==undefined) node.textContent=value;
    return node;
  }
  let fontReady;
  function readyAssets() {
    if (!fontReady) fontReady=(async()=>{
      await Promise.all([[500,"5Medium"],[700,"7Bold"],[800,"8ExtraBold"]].map(async([weight,name])=>{
        const font=new FontFace("MindexBulletin",`url(${new URL(`vendor/fonts/freesentation/Freesentation-${name}.woff2`,document.baseURI)})`,{weight:String(weight)});
        document.fonts.add(await font.load());
      }));
      await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{
        const image=new Image(); image.onload=resolve; image.onerror=()=>reject(new Error("주보 이미지를 불러오지 못했습니다."));
        image.src=new URL(path,document.baseURI).href;
      })));
      await document.fonts.ready;
    })().catch(error=>{fontReady=null;throw error;});
    return fontReady;
  }
  async function readyBackground(doc) {
    await readyAssets();
    if(doc.settings?.design==="simple")return;
    if(doc.source?.department==="children")await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error("어린이부 로고를 불러오지 못했습니다."));image.src=new URL(childrenLogoPath,document.baseURI).href;});
    const background=backgroundFor(doc);
    if(backgroundKey(doc.settings?.theme)==="auto"&&!background)throw new Error("날짜·부서에 맞는 배경이 없습니다. 민덱스 배경에 등록하거나 직접 선택해 주세요.");
    if(doc.settings?.theme&&!background&&!["paper","ink"].includes(doc.settings.theme))throw new Error("이 기기에 선택한 배경이 없습니다. 민덱스 배경 목록에 등록해 주세요.");
    if(background)await new Promise((resolve,reject)=>{
      const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error("선택한 배경을 불러오지 못했습니다. 배경 목록을 확인해 주세요."));
      image.src=new URL(background.url,document.baseURI).href;
    });
  }
  function wrap(text,width,size,weight=500) {
    const ctx=wrap.context||(wrap.context=document.createElement("canvas").getContext("2d"));
    ctx.font=`${weight} ${size}px MindexBulletin`; ctx.fontKerning="normal";
    const fits=s=>ctx.measureText(s).width/MM<=width+.001;
    const result=[];
    for (const paragraph of String(text).split("\n")) {
      let line="";
      for (const part of paragraph.match(/\S+\s*|\s+/gu)||[""]) {
        if (fits(line+part)) {line+=part;continue;}
        if (line.trim()) {result.push(line.trimEnd());line="";}
        if (fits(part)) {line=part;continue;}
        for (const char of Array.from(part)) {
          if (line && !fits(line+char)) {result.push(line.trimEnd());line="";}
          line+=char;
        }
      }
      result.push(line.trimEnd());
    }
    return result;
  }
  function writeText(parent,text,box,issues,id) {
    if (!text) return 0;
    if(box.w<=0||box.h<=0){issues.add(id);return 0;}
    const size=box.size||12.5,weight=box.weight||500;
    const leading=box.leading||snap(size*1.2,TOKENS.baseline);
    const lines=wrap(text,box.w,size,weight);
    if(lines.some(line=>wrap.context.measureText(line).width/MM>box.w+.01))issues.add(id);
    const first=Math.ceil((box.y*MM+size)/TOKENS.baseline)*TOKENS.baseline/MM;
    const end=first+(lines.length-1)*leading/MM;
    if (end+size*.25/MM>box.y+box.h+.01) issues.add(id);
    const anchor=box.align==="right" ? "end" : box.align==="center" ? "middle" : "start";
    const x=box.x+(anchor==="end"?box.w:anchor==="middle"?box.w/2:0);
    lines.forEach((line,i)=>parent.append(svg("text",{x,y:first+i*leading/MM,"font-size":size/MM,
      "font-family":"MindexBulletin","font-weight":weight,"text-anchor":anchor,fill:box.color||"#231f20"},line)));
    return end-box.y+size*.25/MM;
  }
  // Preserve IDML character ranges through wrapping instead of flattening a frame.
  function writeStyled(parent,runs,box,issues,id) {
    const size=box.size||12.5,weight=box.weight||500,ctx=wrap.context||(wrap.context=document.createElement("canvas").getContext("2d"));
    const groups=chars=>{
      const result=[];for(const c of chars){const last=result.at(-1);if(last&&last.size===c.size&&last.weight===c.weight)last.text+=c.text;else result.push({...c});}return result;
    };
    const measure=chars=>groups(chars).reduce((sum,r)=>{ctx.font=`${r.weight} ${r.size}px MindexBulletin`;return sum+ctx.measureText(r.text).width/MM;},0);
    if(box.w<=0||box.h<=0){issues.add(id);return 0;}
    const chars=runs.flatMap(r=>Array.from(r.text||"").map(text=>({text,size:r.size||size,weight:r.weight||weight})));
    const lines=[];let line=[];
    const flush=()=>{while(line.at(-1)?.text===" ")line.pop();lines.push(line);line=[];};
    for(const c of chars){
      if(c.text==="\n"){flush();continue;}
      if(line.length&&measure([...line,c])>box.w+.001){
        const space=line.map(c=>c.text).lastIndexOf(" ");
        if(space>0){const rest=line.slice(space+1);line=line.slice(0,space);flush();line=rest;}
        if(line.length&&measure([...line,c])>box.w+.001)flush();
        if(c.text===" "&&!line.length)continue;
      }
      line.push(c);
    }
    flush();
    const leading=box.leading||snap(chars.reduce((max,c)=>Math.max(max,c.size),size)*1.2);
    const first=Math.ceil((box.y*MM+Math.max(size,...(lines[0]||[]).map(c=>c.size)))/TOKENS.baseline)*TOKENS.baseline/MM;
    let bottom=box.y;
    lines.forEach((chars,i)=>{
      if(measure(chars)>box.w+.01)issues.add(id);
      const y=first+i*leading/MM,anchor=box.align==="right"?"end":box.align==="center"?"middle":"start";
      const node=svg("text",{x:box.x+(anchor==="end"?box.w:anchor==="middle"?box.w/2:0),y,"text-anchor":anchor,"font-family":"MindexBulletin",fill:box.color||"#231f20","xml:space":"preserve"});
      for(const r of groups(chars))node.append(svg("tspan",{"font-size":r.size/MM,"font-weight":r.weight},r.text));
      parent.append(node);bottom=y+Math.max(size,...chars.map(c=>c.size))*.25/MM;
    });
    if(bottom>box.y+box.h+.01)issues.add(id);
    return bottom-box.y;
  }
  // Format person labels only; retain the saved/source spelling.
  function personText(value) {
    return String(value||"").replace(/(^|[\s/·,])([가-힣]{2,5})[ \t]*(선생님|어린이|청년|(?:목사|전도사|집사|권사|장로|서기)(?:님)?)(?=$|[\s/·,])/gu,
      (all,prefix,name,title)=>["위임","담임","원로","부담임","교육","담당"].includes(name)?all:`${prefix}${name} ${title}`);
  }
  function personRuns(value,size=12.5) {
    value=personText(value);
    const match=value.match(/^(.+?)( (?:청년|어린이|선생님|(?:목사|전도사|집사|권사|장로|서기)(?:님)?))$/);
    return match?[{text:match[1],weight:700,size},{text:match[2],weight:500,size}]:[{text:value,size}];
  }
  function copyRuns(value,kind,size) {
    if(kind==="church"&&value.startsWith("기독교대한성결교회 "))return [{text:"기독교대한성결교회 ",weight:500},{text:value.slice("기독교대한성결교회 ".length),weight:700}];
    if(kind==="welcome"&&window.MindexInlineText.plain(value).replace(/\s/g,"")==="오늘도청년부예배에오신여러분을환영하고축복합니다:)")return [
      {text:"오늘도 ",size},{text:"청년부 예배",size,weight:700},{text:"에 오신 여러분을\n",size},
      {text:"환영",size,weight:700},{text:"하고 ",size},{text:"축복",size,weight:800},{text:"합니다 ",size},{text:":)",size,weight:700}];
    if(kind==="verse")return value.split("\n").flatMap((text,i)=>[{text:(i?"\n":"")+text,size:/^—/.test(text)?Math.max(7.5,size-2.5):size}]);
    return window.MindexInlineText.runs(value).map(r=>({text:r.text,...(r.bold?{weight:700}:{})}));
  }

  function recurringNoticeKey(value) {
    const plain=window.MindexInlineText.plain(value).replace(/^\s*(?:[①-⑳◈◇◆]|\d+[.)])\s*/,"").trim();
    if(/^청년부\s*기도 모임\s*\(매주/.test(plain))return "prayer-meeting";
    if(/^검단우리교회는 신천지/.test(plain))return "entry-notice";
    return plain;
  }
  function fieldValue(doc,key) {
    if(key!=="news"&&key!=="notices")return rawFieldValue(doc,key);
    // Saved drafts and source snapshots can still contain the old combined copy.
    const parts=announcementParts(String(rawFieldValue(doc,"news")||""));
    if(key==="news")return [parts.welcome,parts.news].filter(Boolean).join("\n");
    const current=String(rawFieldValue(doc,"notices")||"");
    if(!parts.notices)return current;
    const seen=new Set(current.split("\n").filter(Boolean).map(recurringNoticeKey));
    const extra=parts.notices.split("\n").filter(line=>{const key=recurringNoticeKey(line);if(seen.has(key))return false;seen.add(key);return true;});
    return [current,...extra].filter(Boolean).join("\n");
  }
  function rawFieldValue(doc,key) {
    if(key==="brand"&&!Object.hasOwn(doc.fields,key)&&!Object.hasOwn(doc.inherited?.common||{},key))return "RIA\n청년부";
    if(key==="eventsText") {
      const month=doc.settings.eventsMonth||doc.source?.eventsMonth;
      if(Object.hasOwn(doc.months||{},month))return doc.months[month];
      if(Object.hasOwn(doc.inherited?.months||{},month))return doc.inherited.months[month];
    }
    if(Object.hasOwn(doc.fields,key))return doc.fields[key];
    if(Object.hasOwn(doc.inherited?.common||{},key))return doc.inherited.common[key];
    if(Object.hasOwn(doc.source?.commonOverrides||{},key))return doc.source.commonOverrides[key];
    if(["news","welcome","notices","leader","announcer","outline","sermonReference","outlineTitle","monthlyTheme","memoryVerse","memoryReference","readingPlan","issue"].includes(key)&&doc.source?.[key])return doc.source[key];
    if(key==="eventsText")return doc.source?.events||"";
    if(Object.hasOwn(doc.source?.common||{},key))return doc.source.common[key];
    if(key==="issue")return doc.source?.department==="children"?"":archiveIssues[doc.source?.date]||"";
    return doc.profile?.[key]??"";
  }

  function boundText(doc,frame) {
    const [kind,key]=frame.binding.split(":");
    if(kind==="label")return key;
    if(kind==="month"){const [y,m]=(doc.source?.[key]||"").split("-");return y&&m?`${y}년\n${Number(m)}월`:"";}
    if(kind==="field"&&key==="staff")return personText(fieldValue(doc,key));
    if(kind==="field")return frame.id==="insideChurch"?fieldValue(doc,key).replace(/^기독교대한성결교회\s+/,""):fieldValue(doc,key);
    if(kind==="source")return doc.source?.[key]||"";
    if(kind==="leader")return fieldValue(doc,"leader")?`인도자\n${fieldValue(doc,"leader")}`:"";
    if(kind==="sermon")return [doc.source?.sermon,doc.source?.scripture].filter(Boolean).join("\n");
    if(kind==="issue")return [dateLabel(doc.source?.date),fieldValue(doc,"issue")?`제${fieldValue(doc,"issue")}호`:""].filter(Boolean).join(" · ");
    return "";
  }
  function renderList(group,value,f,issues,columns=1) {
    const lines=String(value||"").replace(/ +(?=(?:일시|장소|교재):)/g,"\n").split("\n").filter(Boolean);
    const columnSize=Math.ceil(lines.length/columns),width=(f.w-(columns-1)*7.5)/columns;
    const mainCount=lines.filter(t=>/^(?:[①-⑳]|\d+[.)])/.test(window.MindexInlineText.plain(t).trimStart())).length;
    let y=f.y,bottom=f.y,lastColumn=0,number=0,indented=false;
    lines.forEach((paragraph,index)=>{
      const col=Math.min(columns-1,Math.floor(index/columnSize));
      if(col!==lastColumn){y=f.y;lastColumn=col;indented=false;}
      const plain=window.MindexInlineText.plain(paragraph);
      const marker=plain.match(/^\s*(?:([①-⑳◈])|(\d{1,2})[.)])\s*(.*)$/);
      const detail=f.id==="news"&&/^\s*(?:-\s*)?(?:일시|장소|교재):/.test(plain);
      if(marker&&index>0&&y>f.y)y+=f.itemGap??(f.id==="news"?(mainCount>2?0:5):2.5);
      let skip=marker?plain.length-marker[3].length:0;
      const bodyRuns=copyRuns(paragraph,f.id,f.size).flatMap(run=>{
        const text=run.text.slice(skip);skip=Math.max(0,skip-run.text.length);
        return text?[{...run,text}]:[];
      });
      if(marker)indented=true;
      const label=marker?(marker[1]==="◈"?"◈":String.fromCodePoint(0x2460+number++)):"";
      const x=f.x+col*(width+7.5),size=detail?Math.max(7.5,f.size-2.5):f.size;
      if(marker)writeText(group,label,{...f,x,y,w:5,h:f.y+f.h-y,align:"center"},issues,f.id);
      y+=writeStyled(group,bodyRuns,{...f,x:x+(indented?7.5:0),y,w:width-(indented?7.5:0),h:f.y+f.h-y,size},issues,f.id);
      bottom=Math.max(bottom,y);
    });
    return bottom-f.y;
  }
  function renderPages(doc,mode,selected) {
    if(doc.settings?.design==="simple")doc=simpleFlow(doc);
    const result=renderPageContent(doc,mode,selected);
    // Advertising frames must not cover other populated copy on the same page.
    const frames=doc.frames.filter(f=>!f.hidden&&['news','notices','welcome','newsTitle','events','eventsTitle','eventsMonth','staff'].includes(f.id)&&String(boundText(doc,f)).trim());
    for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){
      const a=frames[i],b=frames[j];
      if(a.page!==b.page||!['news','notices','welcome'].some(id=>a.id===id||b.id===id))continue;
      if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.1){
        result.issues.add(a.id);result.issues.add(b.id);
      }
    }
    return result;
  }
  function renderPageContent(doc,mode,selected) {
    if(["simple","editorial"].includes(doc.settings?.design))return renderEditorial(doc,mode,selected);
    const issues=new Set(); const pages=[];
    for(let page=0;page<2;page++) {
      const root=svg("svg",{viewBox:"0 0 297 210",class:"bulletin-sheet",role:"img","aria-label":page?"주보 안쪽":"주보 겉면"});
      const theme=doc.settings?.theme||"",background=backgroundFor(doc);
      if(background)root.append(svg("image",{href:new URL(background.url,document.baseURI).href,width:297,height:210,preserveAspectRatio:"xMidYMid slice",...(page?{transform:"translate(297 0) scale(-1 1)"}:{})}));
      else root.append(svg("rect",{width:297,height:210,fill:theme==="ink"?"#202b35":"#fff"}));
      const ink=doc.settings?.design==="ink"||(!doc.settings?.design||doc.settings.design==="auto")&&inkLayout(doc.source?.date);
      for(const x of ink?[0]:[5,153.5])root.append(svg("rect",{x,y:10,width:ink?297:138.5,height:190,fill:"white","fill-opacity":1}));
      if(page===0)root.append(svg("image",{href:new URL(doc.source?.department==="children"?childrenLogoPath:ink?inkLogoPath:logoPath,document.baseURI).href,x:doc.source?.department==="children"?172.75:170,y:doc.source?.department==="children"?53.75:67.5,width:doc.source?.department==="children"?100:105,height:doc.source?.department==="children"?85.89:72.5}));
      for(const f of doc.frames.filter(f=>f.page===page&&(!f.hidden||mode==="layout"))) {
        const group=svg("g",{"data-frame-id":f.id}),frameIssues=f.hidden?new Set():issues;
        if(f.type==="reading") {
          const lines=boundText(doc,f).split("\n").filter(Boolean),rows=Math.ceil(lines.length/2),w=(f.w-7.5)/2;
          const step=rows>4?7.5:25/MM;
          lines.forEach((text,i)=>{const x=f.x+Math.floor(i/rows)*(w+7.5),y=f.y+(i%rows)*step;
            group.append(svg("rect",{x,y:y+1,width:3,height:3,fill:"none",stroke:"#333","stroke-width":.2}));
            const parts=text.match(/^(\d+월 \d+일) \(([^)]+)\) [·–-] (.+)$/);
            const runs=parts?[{text:parts[1]+" "},{text:`(${parts[2]==="일"?"주일":parts[2]})`,size:Math.max(7.5,f.size-2.5)},{text:" – "+parts[3],weight:700}]:[{text}];
            writeStyled(group,runs,{...f,x:x+5,y,w:w-5,h:step},frameIssues,f.id);
          });
          if(rows*step>f.h+.01)frameIssues.add(f.id);
        } else if(doc.source?.department==="children"&&f.id==="monthlyTheme"){
          const lines=boundText(doc,f).split("\n");
          writeStyled(group,lines.map((text,i)=>({text:(i?"\n":"")+text,size:i?Math.max(7.5,f.size-2.5):f.size,weight:i?500:700})),{...f,leading:15},frameIssues,f.id);
        } else if(doc.source?.department==="children"&&f.id==="memoryReference"){
          const value=boundText(doc,f),parts=value.match(/^(.+?)\s+(\d+):(\d+(?:[–-]\d+)?)$/);
          writeStyled(group,parts?[{text:parts[1],weight:700},{text:`\n${parts[2]}장 ${parts[3]}절`,size:Math.max(7.5,f.size-2.5)}]:[{text:value}],{...f,leading:15},frameIssues,f.id);
        } else if(doc.source?.department==="children"&&f.id==="readingHelp"){
          writeStyled(group,[{text:"잠들기 전,\n"},{text:"잠언 읽기!",size:f.size+2.5,weight:700}],{...f,h:12.5,leading:15},frameIssues,f.id);
        } else if(doc.source?.department==="children"&&f.id==="readingFooter"){
          const reading=doc.frames.find(r=>r.id==="readingPlan"),rows=Math.ceil(fieldValue(doc,"readingPlan").split("\n").filter(Boolean).length/2);
          const extended=rows>4&&reading;
          const box=extended?{...f,y:Math.max(f.y,reading.y+rows*7.5),size:10,h:7.5}:f;
          writeText(group,extended?"부모님께 확인받고, 선생님께 달란트 받자!":"부모님께 확인받고,\n선생님께 달란트 받자!",box,frameIssues,f.id);
        } else if(f.type==="rules") {
          for(let y=0;y<=f.h;y+=7.5)group.append(svg("line",{x1:f.x,y1:f.y+y,x2:f.x+f.w,y2:f.y+y,stroke:"#555","stroke-width":.15}));
        } else if(f.binding.startsWith("month:")) {
          const [year,month]=boundText(doc,f).split("\n");
          writeStyled(group,[{text:year||""},{text:month?"\n"+month:"",size:f.size+2.5,weight:700}],f,frameIssues,f.id);
        } else if(f.binding==="leader") {
          const leader=fieldValue(doc,"leader");
          if(leader)writeStyled(group,[{text:"인도자\n",size:f.size},...personRuns(leader,f.size+2.5)],{...f,leading:15},frameIssues,f.id);
        } else if(["church","welcome","verse"].includes(f.id)) {
          writeStyled(group,copyRuns(boundText(doc,f),f.id,f.size),f,frameIssues,f.id);
        } else if(f.binding==="sermon") {
          writeText(group,doc.source?.sermon,{...f,h:7.5},frameIssues,f.id);
          writeText(group,Object.hasOwn(doc.fields,"sermonReference")?fieldValue(doc,"sermonReference"):fieldValue(doc,"sermonReference")||doc.source?.scripture,{...f,y:f.y+7.5,h:f.h-7.5,size:Math.max(7.5,f.size-2.5),weight:500},frameIssues,f.id);
        } else if(f.type==="list") {
          if(f.id==="outline"&&fieldValue(doc,"outlineTitle"))writeText(group,fieldValue(doc,"outlineTitle"),{...f,y:f.y-15,w:45,h:10,size:17.5,weight:700},frameIssues,f.id);
          renderList(group,boundText(doc,f),f,frameIssues,f.id==="outline"?(doc.settings.outlineColumns||doc.source?.outlineColumns||1):1);
        } else if(f.type==="staff") {
          const value=boundText(doc,f),pairs=value.split(/\n|\s*·\s*/).filter(Boolean);
          const parsed=pairs.map(t=>t.match(/^(위임목사|담당 교역자|회장|총무|서기|회계|부장)\s+(.+)$/));
          if(parsed.every(Boolean)&&(parsed.length===6||(doc.source?.department==="children"&&parsed.length===4)))parsed.forEach((row,i)=>{
            const col=(f.w-7.5)/2,x=f.x+(i%2)*(col+7.5),y=f.y+Math.floor(i/2)*(doc.source?.department==="children"?15:7.5);
            writeText(group,row[1],{...f,x,y,w:col,h:7.5},frameIssues,f.id);
            writeText(group,row[2],{...f,x,y,w:col,h:7.5,align:"right"},frameIssues,f.id);
          });else writeText(group,value,f,frameIssues,f.id);
        } else if(f.type==="events") {
          let y=f.y;
          for(const line of String(boundText(doc,f)).split("\n").filter(Boolean)) {
            const printed=line.includes(" | ");
            const parts=printed?line.match(/^(.+?) \| (.+)$/):line.match(/^(\d+월 \d+일)\s+(.+)$/);
            if(!parts){y+=writeText(group,line,{...f,y,h:f.y+f.h-y},frameIssues,f.id)+2.5;continue;}
            const body=parts[2],labelWidth=printed?65:30,bodyX=labelWidth+5,bodyWidth=f.w-bodyX;
            if(bodyWidth<10){frameIssues.add(f.id);continue;}
            const h=Math.max(7.5,Math.max(wrap(body,bodyWidth,f.size).length,wrap(parts[1],labelWidth,f.size).length)*snap(f.size*1.2)/MM+2.5);
            const dateTime=printed?parts[1].match(/^(.*?\))\s+((?:평일 )?(?:오전|오후).*)$/):null;
            if(dateTime)writeStyled(group,[{text:dateTime[1]+"   ",weight:700},{text:dateTime[2],size:Math.max(7.5,f.size-2.5)}],{...f,y,w:labelWidth,h},frameIssues,f.id);
            else writeText(group,parts[1],{...f,y,w:labelWidth,h},frameIssues,f.id);
            writeText(group,body,{...f,x:f.x+bodyX,y,w:bodyWidth,h,align:"right",weight:700},frameIssues,f.id);y+=h;
            if(y>f.y+f.h+.01)frameIssues.add(f.id);
          }
        } else if(f.type==="order") {
          const list=(doc.source?.order||[]).map(row=>({...row,person:personText(row.label==="광고"?fieldValue(doc,"announcer"):row.person)})),inner=f.w-60;
          if(inner<10){frameIssues.add(f.id);root.append(group);continue;}
          const leading=snap(f.size*1.2)/MM;
          const counts=list.map(row=>Math.max(wrap(row.label,30,f.size).length,wrap(row.content,inner,f.size,700).length,wrap(row.person,30,f.size).length));
          const rowLeading=list.map(row=>["찬양","찬송"].includes(row.label)&&row.content.includes("\n")?Math.max(leading,25/MM):leading);
          const used=counts.reduce((sum,n,i)=>sum+n*rowLeading[i],0),gap=list.length>1?Math.max(2.5,(f.h-2.5-used)/(list.length-1)):0;
          let y=f.y;
          list.forEach((row,i)=>{
            const height=counts[i]*rowLeading[i],base={...f,y,h:height+2.5,leading:rowLeading[i]*MM};
            const centered=y+Math.max(0,(counts[i]-1)*rowLeading[i]/2);
            const printLabel=row.label==="봉헌찬양"?"봉헌":row.label;
            const letters=printLabel.replace(/\s/g,"");
            if(letters.length>1&&letters.length<=5) [...letters].forEach((letter,j)=>writeText(group,letter,{...base,y:centered,x:f.x+j*27.5/(letters.length-1),w:6},frameIssues,f.id));
            else writeText(group,row.label,{...base,y:centered,w:30},frameIssues,f.id);
            const songRuns=row.content.split("\n").flatMap((text,i)=>{
              const hymn=["찬양","찬송"].includes(row.label)?text.match(/^(\d+) (.+)$/):null;
              return hymn?[{text:(i?"\n":"")+hymn[1],size:Math.max(7.5,f.size-2.5),weight:500},{text:" "+hymn[2],weight:700}]:[{text:(i?"\n":"")+text,weight:700}];
            });
            writeStyled(group,songRuns,{...base,x:f.x+30,w:inner,align:"center",weight:700},frameIssues,f.id);
            const personLetters=Array.from(row.person.replace(/\s/g,""));
            if(!/\s/.test(row.person)&&personLetters.length>1&&personLetters.length<=6)personLetters.forEach((letter,j)=>writeText(group,letter,{...base,y:centered,x:f.x+f.w-30+j*25/(personLetters.length-1),w:5},frameIssues,f.id));
            else writeText(group,row.person,{...base,y:centered,x:f.x+f.w-30,w:30,align:"right"},frameIssues,f.id);
            y+=height+(i<list.length-1?gap:0);
          });
          if(y>f.y+f.h+.01)frameIssues.add(f.id);
        } else if(f.type==="prayers") {
          const list=doc.source?.prayers||[],left=Math.floor(list.length/2),col=(f.w-5)/2;
          if(col<=38.5){frameIssues.add(f.id);root.append(group);continue;}
          list.forEach((r,i)=>{
            const x=f.x+(i>=left?col+5:0),y=f.y+(i>=left?i-left:i)*10;
            writeText(group,shortDate(r.date),{...f,x,y,w:27.5,h:10},frameIssues,f.id);
            if(r.next){group.append(svg("rect",{x:x+29,y:y+2,width:9,height:4,rx:2,fill:"white",stroke:"#555","stroke-width":.2}));
              writeText(group,"NEXT",{...f,x:x+29,y:y+1,w:9,h:7.5,size:7.5,align:"center"},frameIssues,f.id);}
            writeStyled(group,personRuns(r.person,f.size),{...f,x:x+38.5,y,w:col-38.5,h:10,align:"right"},frameIssues,f.id);
            if(y+10>f.y+f.h+.01)frameIssues.add(f.id);
          });
        } else writeText(group,boundText(doc,f),{...f,color:(doc.source?.department==="children"?["website","meeting"].includes(f.id):f.y<10||f.y>=200)&&(background||theme==="ink")?"#fff":"#231f20"},frameIssues,f.id);
        if(mode==="layout") {
          group.append(svg("rect",{class:`bulletin-frame-hit${selected===f.id?" is-selected":""}`,x:f.x,y:f.y,width:f.w,height:f.h,
            fill:"transparent",stroke:selected===f.id?"#477953":"#47795380","stroke-width":.25,"data-frame-hit":f.id}));
          if(selected===f.id)group.append(svg("rect",{class:"bulletin-resize",x:f.x+f.w-1.5,y:f.y+f.h-1.5,width:3,height:3,fill:"#477953","data-resize":f.id}));
        }
        root.append(group);
      }
      pages.push(root);
    }
    return {pages,issues};
  }

  const isRecord=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
  function normalizeSnapshot(value={}) {
    const values={},settings={},frames=defaultFrames(value?.settings?.design),months={},inherited={common:{},months:{}};
    if(!isRecord(value))value={};
    for(const key of Object.keys(fields))if(typeof value.fields?.[key]==="string")values[key]=value.fields[key];
    for(const key of ["eventsMonth","rosterMonth"])if(validMonth(value.settings?.[key]))settings[key]=value.settings[key];
    if(typeof value.settings?.theme==="string")settings.theme=value.settings.theme;
    settings.compactOrder=value.settings?.compactOrder!==false;
    settings.archiveReference=value.settings?.archiveReference!==false;
    if(["auto","ink","panels","editorial","simple","children"].includes(value.settings?.design))settings.design=value.settings.design;
    for(const [key,min,max] of [["lineHeight",1.2,1.9],["itemGap",1,8],["orderPadding",1,5]])if(Number.isFinite(value.settings?.[key])&&value.settings[key]>=min&&value.settings[key]<=max)settings[key]=value.settings[key];
    if(value.settings?.templateKey===TEMPLATE_KEY){settings.templateKey=TEMPLATE_KEY;settings.templateRevision=Number(value.settings.templateRevision)||0;}
    if([1,2].includes(value.settings?.outlineColumns))settings.outlineColumns=value.settings.outlineColumns;
    for(const f of frames){
      let patch=Array.isArray(value.frames)?value.frames.find(p=>isRecord(p)&&p.id===f.id):null;
      if(patch&&value.settings?.design==="children"){
        const old=legacyChildrenFrames().find(p=>p.id===f.id);
        // Upgrade only an untouched old default; preserve every custom frame.
        if(old&&["x","y","w","h","size","align"].every(key=>patch[key]===old[key])&&!patch.hidden)patch=null;
      }
      if(!patch)continue;
      for(const key of ["x","y","w","h","size"]){
        const n=patch[key];
        if(typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=297&&(key!=="size"||TOKENS.fontSizes.includes(n)))f[key]=n;
      }
      f.w=Math.max(10,Math.min(297,f.w));f.h=Math.max(5,Math.min(210,f.h));
      f.x=Math.min(f.x,297-f.w);f.y=Math.min(f.y,210-f.h);
      f.hidden=patch.hidden===true;if(["left","center","right"].includes(patch.align))f.align=patch.align;
    }
    for(const [month,text] of Object.entries(isRecord(value.months)?value.months:{}))if(validMonth(month)&&typeof text==="string")months[month]=text;
    for(const key of profileKeys)if(typeof value.inherited?.common?.[key]==="string")inherited.common[key]=value.inherited.common[key];
    for(const [month,text] of Object.entries(isRecord(value.inherited?.months)?value.inherited.months:{}))if(validMonth(month)&&typeof text==="string")inherited.months[month]=text;
    return {fields:values,settings,frames,months,inherited,sourceSnapshot:normalizeSourceSnapshot(value.sourceSnapshot)};
  }
  function readLocal(key) {
    try{return JSON.parse(window.MINDEX_SERVER_STORAGE?.getItem("local",key)||"null");}catch{return null;}
  }
  function bulletinDrafts(key){
    return [key,key+":recovery",...(window.MINDEX_SERVER_STORAGE?.keys?.("local")||[]).filter(k=>k.startsWith(key+":draft:")||k.startsWith(key+":recovery:"))]
      .map(readLocal).filter(v=>isRecord(v)&&[1,2,3].includes(v.version)&&isRecord(v.fields)&&Array.isArray(v.frames))
      .sort((a,b)=>(Number(b.savedAt)||0)-(Number(a.savedAt)||0));
  }
  const draftSignature=value=>JSON.stringify(normalizeSnapshot(value));
  function restore(scope,id) {
    const key=`mindex.bulletin.v1:${scope}:${id}`,saved=bulletinDrafts(key)[0];
    const hasLocal=isRecord(saved)&&[1,2,3].includes(saved.version);
    const value=normalizeSnapshot(hasLocal?saved:{});
    if(saved?.version===1&&!Object.hasOwn(value.settings,"theme"))value.settings.theme="26-A5.png";
    return {key,...value,hasLocal,savedAt:Number(saved?.savedAt)||0,source:null,history:[],future:[],revision:0,dirty:false,saving:false,backupUnavailable:false};
  }
  function snapshot(doc){return {fields:clone(doc.fields),settings:clone(doc.settings||{}),frames:clone(doc.frames),months:clone(doc.months||{}),inherited:clone(doc.inherited||{common:{},months:{}}),sourceSnapshot:clone(doc.sourceSnapshot||null)};}

  const weeklySourceKeys=["leader","announcer","sermon","scripture","news","notices","welcome","outline","outlineTitle","sermonReference","liturgical","monthlyTheme","memoryVerse","memoryReference","readingPlan","issue"];
  function normalizeSourceSnapshot(value) {
    if(!isRecord(value)||typeof value.serviceId!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value.date||""))return null;
    const weekly={};for(const key of weeklySourceKeys)if(typeof value.weekly?.[key]==="string")weekly[key]=value.weekly[key];
    if(!Array.isArray(value.weekly?.order)||!value.weekly.order.every(r=>isRecord(r)&&["id","label","content","person"].every(k=>typeof r[k]==="string")))return null;
    weekly.order=value.weekly.order.map(r=>Object.fromEntries(["id","label","content","person"].map(k=>[k,r[k]])));
    weekly.outlineColumns=value.weekly.outlineColumns===2?2:1;
    weekly.archiveReference=value.weekly.archiveReference===true;
    const rosters={};
    for(const [month,rows] of Object.entries(isRecord(value.rosters)?value.rosters:{}))if(validMonth(month)&&Array.isArray(rows)&&rows.every(r=>isRecord(r)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")&&typeof r.person==="string"))rosters[month]=rows.map(r=>({date:r.date,person:r.person,next:r.next===true}));
    return {serviceId:value.serviceId,date:value.date,weekly,rosters};
  }
  function captureSource(doc) {
    if(!doc.source?.id)return null;
    const source=doc.source,weekly=Object.fromEntries(weeklySourceKeys.map(k=>[k,source[k]||""]));
    Object.assign(weekly,{order:clone(source.order||[]),outlineColumns:source.outlineColumns||1,archiveReference:!!source.archiveReference});
    const rosters=clone(doc.sourceSnapshot?.rosters||{});
    if(validMonth(source.rosterMonth))rosters[source.rosterMonth]=clone(source.prayers||[]);
    return normalizeSourceSnapshot({serviceId:source.id,date:source.date,weekly,rosters});
  }
  function applySourceSnapshot(source,value) {
    const saved=normalizeSourceSnapshot(value);
    if(!saved||saved.serviceId!==source.id||saved.date!==source.date)return source;
    const result={...source,...clone(saved.weekly)};
    if(saved.rosters[source.rosterMonth])result.prayers=clone(saved.rosters[source.rosterMonth]);
    return result;
  }
  const TEMPLATE_KEY="young-adult-2027";
  function templateValue(doc) {
    const layout=storedValue(doc).layout;
    return {title:"2027 청년부 공통 양식",department:"young-adult",effective_from:"2026-11-01",
      layout:{...layout,compactOrder:doc.settings.compactOrder!==false},
      common:Object.fromEntries(profileKeys.map(key=>[key,fieldValue(doc,key)]))};
  }
  function normalizeTemplate(row) {
    if(!row||row.template_key!==TEMPLATE_KEY||row.department!=="young-adult"||!Number.isInteger(row.revision)||row.revision<1||!isRecord(row.layout)||!isRecord(row.common))throw new Error("공통 양식 저장 데이터를 확인해 주세요.");
    const normalized=normalizeSnapshot({fields:row.common,settings:{...row.layout,theme:row.layout.background},frames:row.layout.frames});
    return {...row,layout:{...row.layout,design:normalized.settings.design||"simple",frames:normalized.frames},common:Object.fromEntries(profileKeys.filter(k=>typeof row.common[k]==="string").map(k=>[k,row.common[k]]))};
  }
  function applyTemplate(doc,row) {
    row=normalizeTemplate(row);
    const value=normalizeSnapshot({settings:{...row.layout,theme:row.layout.background},frames:row.layout.frames});
    // Never import weekly fields, dates, source snapshots or roster data from a template.
    Object.assign(doc.settings,value.settings,{templateKey:row.template_key,templateRevision:row.revision});
    doc.frames=value.frames;
    doc.inherited.common={...doc.inherited.common,...row.common};
  }
  function storedValue(doc) {
    const {theme,compactOrder,eventsMonth,rosterMonth}=doc.settings;
    const common=Object.fromEntries(profileKeys.filter(key=>Object.hasOwn(doc.fields,key)).map(key=>[key,doc.fields[key]]));
    const months=clone(doc.months||{}),month=eventsMonth||doc.source?.eventsMonth;
    if(validMonth(month)&&Object.hasOwn(doc.fields,"eventsText"))months[month]=doc.fields.eventsText;
    const inherited={common:Object.fromEntries(profileKeys.map(key=>[key,fieldValue(doc,key)])),months:clone(doc.inherited?.months||{})};
    if(validMonth(month))inherited.months[month]=fieldValue(doc,"eventsText");
    return {content:{templateKey:doc.settings.templateKey,templateRevision:doc.settings.templateRevision,fields:clone(doc.fields),eventsMonth,rosterMonth,compactOrder:compactOrder!==false,archiveReference:doc.settings.archiveReference!==false,sourceSnapshot:captureSource(doc),months,inherited,reuse:{common:doc.settings.templateKey?{}:common,months}},
      layout:{lineHeight:doc.settings.lineHeight,itemGap:doc.settings.itemGap,orderPadding:doc.settings.orderPadding,background:backgroundKey(theme),frames:clone(doc.frames),outlineColumns:doc.settings.outlineColumns||doc.source?.outlineColumns||1,design:doc.settings.design&&doc.settings.design!=="auto"?doc.settings.design:inkLayout(doc.source?.date)?"ink":"panels"}};
  }
  function applyStored(doc,row) {
    if(!row||!Number.isInteger(row.revision)||row.revision<1||!isRecord(row.content)||!isRecord(row.layout)
      ||(row.layout.frames!==undefined&&!Array.isArray(row.layout.frames)))throw new Error("주보 저장 데이터 형식을 확인해 주세요.");
    const value=normalizeSnapshot({fields:row.content.fields,settings:{...row.content,lineHeight:row.layout.lineHeight,itemGap:row.layout.itemGap,orderPadding:row.layout.orderPadding,theme:row.layout.background,outlineColumns:row.layout.outlineColumns,design:row.layout.design},frames:row.layout.frames,months:row.content.months,inherited:row.content.inherited,sourceSnapshot:row.content.sourceSnapshot});
    Object.assign(doc,value,{revision:row.revision,dirty:false,history:[],future:[]});
  }

  function mount(host,options) {
    const controller=new AbortController(),signal=controller.signal;
    let doc,mode="content",selected="news",loading=false,assetLoaded=false,error="",serial=0,saveError="",printError="",printing=false,issues=new Set();
    const documents=options.documents||new Map(),disclosureState=new Map();
    let templateRow=null,templateError="",templateSession=null,templateDraft=null;
    const on=(target,event,fn)=>target.addEventListener(event,fn,{signal});
    host.innerHTML=`<section class="bulletin-workbench" aria-label="주보 편집">
      <header class="bulletin-toolbar">
      <select aria-label="주보 예배" data-bulletin-service>${options.services.map(s=>`<option value="${escape(s.id)}">${escape(s.label)}</option>`).join("")}</select>
      <button type="button" data-bulletin-template-edit hidden>2027 공통 양식 편집</button><button type="button" data-bulletin-template-exit hidden>주보로 돌아가기</button><span class="bulletin-spacer"></span><div class="bulletin-history" role="group" aria-label="편집 기록">
      <button type="button" data-bulletin-undo aria-label="주보 실행 취소" title="실행 취소"><i data-lucide="undo-2"></i></button><button type="button" data-bulletin-redo aria-label="주보 다시 실행" title="다시 실행"><i data-lucide="redo-2"></i></button></div>
      <button type="button" data-bulletin-save><i data-lucide="save"></i><span>저장</span></button><button class="bulletin-primary" type="button" data-bulletin-print disabled><i data-lucide="printer"></i><span>인쇄 / PDF</span></button></header>
      <div class="bulletin-meta"><div class="bulletin-status" role="status"></div><div class="bulletin-source-actions" role="group" aria-label="주보 자료"><button type="button" data-bulletin-local title="서버에 보관된 복구 초안을 불러옵니다">임시 초안</button><button type="button" data-bulletin-reload title="DB에 저장한 주보 내용과 양식을 다시 불러옵니다">저장본 불러오기</button><button type="button" data-bulletin-refresh title="연결된 예배·교회력에서 최신 자료를 가져옵니다"><i data-lucide="refresh-cw"></i><span>예배 자료 갱신</span></button></div></div>
      <div class="bulletin-body"><aside class="bulletin-inspector" aria-label="주보 편집 도구">
      <div class="bulletin-modes" role="group" aria-label="편집 방식"><button type="button" data-bulletin-mode="content">내용</button><button type="button" data-bulletin-mode="layout">양식</button></div>
      <div class="bulletin-properties"></div></aside><section class="bulletin-preview" aria-label="인쇄 미리보기"><div class="bulletin-preview-head"><strong>미리보기</strong><div class="bulletin-page-nav" role="group" aria-label="주보 면 이동"><button type="button" data-bulletin-page="0">겉면</button><button type="button" data-bulletin-page="1">안쪽</button></div><span>A4 가로 · 2쪽</span></div><div class="bulletin-canvas" tabindex="0" aria-label="주보 페이지"></div></section></div></section>`;
    const root=host.firstElementChild,q=selector=>root.querySelector(selector);
    window.lucide?.createIcons({root});
    function showPage(index){
      const canvas=q(".bulletin-canvas"),page=canvas.querySelectorAll(".bulletin-sheet")[index];
      if(page)canvas.scrollTo({top:canvas.scrollTop+page.getBoundingClientRect().top-canvas.getBoundingClientRect().top-15,behavior:"instant"});
      pageNavigation();
    }
    root.querySelectorAll("[data-bulletin-page]").forEach(button=>on(button,"click",()=>showPage(Number(button.dataset.bulletinPage))));
    function pageNavigation(){
      const canvas=q(".bulletin-canvas"),bounds=canvas.getBoundingClientRect();
      const pages=[...canvas.querySelectorAll(".bulletin-sheet")];
      const areas=pages.map(page=>{const r=page.getBoundingClientRect();return Math.max(0,Math.min(r.bottom,bounds.bottom)-Math.max(r.top,bounds.top));});
      const current=areas.length?areas.indexOf(Math.max(...areas)):-1;
      root.querySelectorAll("[data-bulletin-page]").forEach((button,i)=>{
        button.disabled=loading||!assetLoaded||!pages[i];
        if(i===current)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");
      });
    }
    on(q(".bulletin-canvas"),"scroll",pageNavigation);
    const previewResize=new ResizeObserver(pageNavigation);previewResize.observe(q(".bulletin-canvas"));
    function loadProfile(date) {
      let versions=[];try{versions=JSON.parse(window.MINDEX_SERVER_STORAGE?.getItem("local",`mindex.bulletin.profiles:${options.scope}`)||"[]");}catch{}
      const profile={};
      if(Array.isArray(versions))for(const v of versions.filter(v=>v&&typeof v.date==="string"&&v.date<=date).sort((a,b)=>a.date.localeCompare(b.date)))
        for(const k of profileKeys)if(typeof v.fields?.[k]==="string")profile[k]=v.fields[k];
      return profile;
    }
    function remember(before=snapshot(doc)){doc.history.push(before);if(doc.history.length>50)doc.history.shift();doc.future=[];}
    async function writeLocal(target,key,value) {
      target.backupPending=true;status();
      try{
        if(!window.MINDEX_SERVER_STORAGE?.ready)throw Error("서버 보관 연결이 필요합니다.");
        await window.MINDEX_SERVER_STORAGE.setItem("local",key,JSON.stringify(value));
        target.backupUnavailable=false;return true;
      }catch(error){target.backupUnavailable=true;throw error;}
      finally{target.backupPending=false;status();}
    }
    function backup(target=doc){
      const savedAt=Date.now(),value=snapshot(target);
      target.backupPending=true;
      const accepted=window.MINDEX_SERVER_STORAGE?.queue("local",target.sessionDraftKey||(target.sessionDraftKey=target.key+":draft:"+crypto.randomUUID()),JSON.stringify({version:3,...value,savedAt,...(templateSession&&target===doc?{templateDirty:target.dirty,templateRevision:target.revision}:{})}));
      if(!accepted){target.backupPending=false;target.backupUnavailable=true;}
      if(target.dirty)window.MINDEX_DRAFT_HANDOFF?.publish(templateSession&&target===doc?'bulletin-template':'bulletin',templateSession&&target===doc?TEMPLATE_KEY:String(target.id),{schema:1,revision:target.revision,value},target.source?.title||'주보 초안');
      status();
    }
    async function retainRecovery(target,value) {
      const preserved=normalizeSnapshot(value);
      const previous=readLocal(target.key+":recovery");
      if(previous)await writeLocal(target,target.key+":recovery:"+crypto.randomUUID(),previous);
      await writeLocal(target,target.key+":recovery:"+crypto.randomUUID(),{version:3,...preserved,savedAt:Date.now()});
      await writeLocal(target,target.key+":recovery",{version:3,...preserved,savedAt:Date.now()});
      target.localDraft=preserved;
    }
    function recoveryChoices(){
      if(!doc)return [];
      const seen=new Set([draftSignature(doc)]);
      return [...bulletinDrafts(doc.key),...(doc.localDraft?[doc.localDraft]:[])].filter(value=>{
        const signature=draftSignature(value);if(seen.has(signature))return false;seen.add(signature);return true;
      });
    }
    function reviewLocalDraft(){
      const choices=recoveryChoices();if(!choices.length||loading||doc.saving)return;
      const target=doc,request=serial,before=draftSignature(doc);
      const dialog=document.createElement('dialog');dialog.className='editor-draft-review';dialog.setAttribute('aria-label','주보 임시 초안 확인');
      const title=document.createElement('h2');title.textContent='주보 임시 초안 확인';dialog.append(title);
      const note=document.createElement('p');note.textContent='현재 입력과 선택한 초안을 보관한 뒤 편집창에 복구합니다. 저장본은 바뀌지 않습니다.';dialog.append(note);
      const select=document.createElement('select');select.setAttribute('aria-label','복구할 주보 초안');
      choices.forEach((value,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=value.savedAt?new Date(value.savedAt).toLocaleString('ko-KR'):'기존 초안 · 보관 시각 정보 없음';select.append(option)});dialog.append(select);
      const columns=document.createElement('div');columns.className='editor-draft-preview';dialog.append(columns);
      const previewText=value=>Object.entries(value.fields||{}).map(([key,text])=>`${fields[key]||key}\n${text}`).join('\n\n')+`\n\n배치 ${value.frames?.length||0}개 · 배경 ${value.settings?.theme||'기본'}`;
      const field=(label,value)=>{const l=document.createElement('label');l.textContent=label;const t=document.createElement('textarea');t.readOnly=true;t.setAttribute('aria-label',label);t.value=previewText(value);l.append(t);columns.append(l);return t};
      field('현재 입력',target);const incoming=field('복구할 내용',choices[0]);select.onchange=()=>incoming.value=previewText(choices[Number(select.value)]);
      const message=document.createElement('p');message.setAttribute('role','status');dialog.append(message);
      const actions=document.createElement('div');actions.className='editor-draft-actions';dialog.append(actions);
      const close=document.createElement('button');close.className='btn secondary';close.textContent='닫기';close.onclick=()=>dialog.close();actions.append(close);
      const apply=document.createElement('button');apply.className='btn primary';apply.textContent='편집창에 복구';actions.append(apply);
      const unchanged=()=>dialog.open&&doc===target&&request===serial&&!signal.aborted&&!loading&&!target.saving&&!printing&&!printSession&&!options.remoteBlocked?.()&&draftSignature(target)===before;
      apply.onclick=async()=>{
        if(!unchanged()){message.textContent='현재 입력이나 화면이 바뀌었습니다. 닫고 다시 확인해 주세요.';return}
        apply.disabled=true;select.disabled=true;
        try{
          const selected=normalizeSnapshot(choices[Number(select.value)]);
          await retainRecovery(target,selected);
          if(!unchanged())throw Error('입력이 바뀌어 현재 내용을 유지했습니다.');
          await retainRecovery(target,snapshot(target));
          if(!unchanged())throw Error('입력이 바뀌어 현재 내용을 유지했습니다.');
          remember();Object.assign(target,selected);persist();properties();preview();status();dialog.close();
        }catch(e){message.textContent=e.message;}finally{apply.disabled=false;select.disabled=false;}
      };
      dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
    }
    function persist(){doc.dirty=true;doc.saveError="";saveError="";printError="";backup();}
    async function editTemplate(){
      if(loading||doc?.saving||templateSession)return;
      if(!options.loadTemplate||!options.saveTemplate){saveError="공통 양식 DB 연결이 필요합니다.";status();return;}
      const weekly=doc;loading=true;status();
      try{
        const row=await options.loadTemplate(TEMPLATE_KEY);if(signal.aborted||doc!==weekly)return;
        templateRow=row?normalizeTemplate(row):null;
        if(templateDraft&&!templateDraft.dirty)templateDraft=null;
        templateSession={weekly,mode};
        const value=templateRow||{template_key:TEMPLATE_KEY,revision:1,...templateValue({...weekly,settings:{...weekly.settings,design:"simple"},frames:defaultFrames("simple")})};
        doc=templateDraft||{...weekly,...normalizeSnapshot(snapshot(weekly)),key:`mindex.bulletin.template:${options.scope}:${TEMPLATE_KEY}`,sessionDraftKey:null,history:[],future:[],dirty:!templateRow,revision:templateRow?.revision||0,saveError:"",saving:false,localDraft:null};
        if(!templateDraft){applyTemplate(doc,value);doc.fields={...value.common};doc.profile={};doc.sourceSnapshot=null;}
        if(!templateDraft){
          const saved=bulletinDrafts(doc.key).find(v=>v.templateDirty!==undefined);
          if(saved?.templateDirty&&saved?.templateRevision===(templateRow?.revision||0)){Object.assign(doc,normalizeSnapshot(saved));doc.dirty=true;}
        }
        doc.source=weekly.source;doc.backgrounds=weekly.backgrounds;
        templateDraft=doc;mode="layout";saveError=doc.saveError||"";templateError="";
      }catch(e){saveError=e.message;}finally{loading=false;properties();preview();status();}
    }
    function exitTemplate(){
      if(!templateSession||doc.saving)return;
      endDrag();templateDraft=doc;doc=templateSession.weekly;mode=templateSession.mode;templateSession=null;saveError=doc.saveError||"";properties();preview();status();
    }
    async function saveTemplate(){
      const target=doc;if(!templateSession||target.saving||loading||error)return false;
      endDrag();const value=templateValue(target),before=JSON.stringify(snapshot(target));target.saving=true;saveError="";status();
      try{
        const row=normalizeTemplate(await options.saveTemplate(TEMPLATE_KEY,value,target.revision));
        templateRow=row;target.revision=row.revision;target.settings.templateRevision=row.revision;
        // Revision metadata is not an edit; preserve any edits made while saving.
        const current=snapshot(target);current.settings.templateRevision=JSON.parse(before).settings.templateRevision;
        target.dirty=JSON.stringify(current)!==before;target.saveError="";backup(target);return !target.dirty;
      }catch(e){target.dirty=true;target.saveError=e.message;saveError=e.message;return false;}
      finally{target.saving=false;properties();status();}
    }
    async function save(){
      if(templateSession)return saveTemplate();
      const target=doc;if(!target||target.saving||loading||error||!target.dbLoaded)return false;
      endDrag();
      if(!target.dirty&&target.revision)return true;
      const value=storedValue(target),before=JSON.stringify(snapshot(target));target.saving=true;target.saveError="";saveError="";status();
      try{
        if(!options.saveDraft)throw new Error("주보 DB 저장 연결이 필요합니다.");
        const row=await options.saveDraft(target.id,value,target.revision);
        target.revision=row.revision;target.dirty=JSON.stringify(snapshot(target))!==before;
        if(!target.dirty){target.sourceSnapshot=value.content.sourceSnapshot;target.settings.outlineColumns=value.layout.outlineColumns;target.settings.design=value.layout.design;}
        backup(target);return !target.dirty;
      }catch(e){target.saveError=e.message;if(doc===target)saveError=e.message;target.dirty=true;return false;}
      finally{target.saving=false;window.dispatchEvent(new CustomEvent("mindex-bulletin-save-settled",{detail:target}));}
    }
    on(window,"mindex-bulletin-save-settled",event=>{if(event.detail===doc){saveError=doc.saveError||"";status();}});
    on(root,"mindex-bulletin-save",event=>{const result=save();if(event.detail)event.detail.result=result;});
    on(window,"mindex-server-state-settled",()=>{if(!signal.aborted)status()});
    function status(){
      if(doc?.backupPending){
        const confirmed=readLocal(doc.sessionDraftKey||doc.key);
        if(confirmed?.savedAt&&JSON.stringify(normalizeSnapshot(confirmed))===JSON.stringify(snapshot(doc))){doc.savedAt=confirmed.savedAt;doc.backupPending=false;doc.backupUnavailable=false;}
      }

      const text=error||saveError||printError||(loading?"저장된 예배 자료를 불러오는 중…":!assetLoaded?"글꼴과 이미지를 준비하는 중…":
        issues.size?`영역 넘침·겹침: ${[...issues].map(frameLabel).join(", ")}`:"");
      q(".bulletin-status").textContent=[text,`${templateSession?"공통 양식 편집":"이번 주 편집"} · ${doc?.saving?"저장 중…":doc?.dirty?"수정 중":doc?.revision?"저장됨":"저장 전"}`,templateSession?"":templateError,doc?.backupUnavailable?"서버 초안 보관 실패":doc?.backupPending?"서버 초안 보관 중":""].filter(Boolean).join(" · ");
      q(".bulletin-status").hidden=!q(".bulletin-status").textContent;
      q(".bulletin-status").dataset.state=error||saveError||printError||doc?.backupUnavailable||issues.size?"warning":loading||!assetLoaded?"loading":"saved";
      q("[data-bulletin-print]").disabled=printing||loading||!assetLoaded||!!error||!doc?.source?.order.length||issues.size>0;
      q("[data-bulletin-undo]").disabled=loading||!doc?.history.length;
      q("[data-bulletin-redo]").disabled=loading||!doc?.future.length;
      q("[data-bulletin-refresh]").disabled=loading||!!doc?.saving||!!templateSession;
      q("[data-bulletin-save]").disabled=loading||!!error||!!doc?.saving||!doc?.dbLoaded||(!doc?.dirty&&!!doc?.revision);
      q("[data-bulletin-save] span").textContent=doc?.saving?"저장 중…":templateSession?"공통 양식 저장":"주보 저장";
      q("[data-bulletin-save]").setAttribute("aria-busy",String(!!doc?.saving));
      q("[data-bulletin-print] span").textContent=printing?"인쇄 준비 중…":"인쇄 / PDF";
      q("[data-bulletin-reload]").disabled=loading||!!doc?.saving||!!templateSession;
      q("[data-bulletin-service]").disabled=loading||!!templateSession;
      q("[data-bulletin-template-edit]").hidden=!!templateSession||doc?.source?.department!=="young-adult"||!options.loadTemplate;
      q("[data-bulletin-template-edit]").disabled=loading||!!doc?.saving;
      q("[data-bulletin-template-exit]").hidden=!templateSession;
      q("[data-bulletin-template-exit]").disabled=!!doc?.saving;
      pageNavigation();
      q("[data-bulletin-local]").hidden=!!templateSession||!recoveryChoices().length;
      q("[data-bulletin-local]").disabled=loading||!!doc?.saving;
      root.querySelectorAll(".bulletin-properties input,.bulletin-properties select,.bulletin-properties textarea,.bulletin-properties button").forEach(el=>el.disabled=loading||(!doc?.dbLoaded&&!!error));
      options.onStateChange?.();
    }
    function preview(){
      if(!doc||!assetLoaded){status();return;}
      const rendered=renderPages(doc,mode,selected);issues=rendered.issues;
      q(".bulletin-canvas").replaceChildren(...rendered.pages);status();
    }
    function fitInputs(){
      root.querySelectorAll('.bulletin-properties textarea').forEach(input=>{
        if(!input.getClientRects().length)return;
        input.style.height='auto';
        input.style.height=`${input.scrollHeight+2}px`;
      });
    }
    const inputResize=new ResizeObserver(()=>fitInputs());inputResize.observe(q('.bulletin-inspector'));
    root.addEventListener('toggle',fitInputs,{capture:true,signal});
    function properties(){
      root.querySelectorAll("[data-bulletin-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.bulletinMode===mode)));
      const p=q(".bulletin-properties"),sections=[...p.querySelectorAll("details[data-bulletin-section]")];
      if(sections.length&&p.dataset.documentId&&p.dataset.sectionsReady==="true")disclosureState.set(p.dataset.documentId,{...disclosureState.get(p.dataset.documentId),...Object.fromEntries(sections.map(el=>[el.dataset.bulletinSection,el.open]))});
      if(!doc){p.replaceChildren();return;}
      if(mode==="content") {
        const child=doc.source?.department==="children";
        const field=key=>`<label ${["news","outline","notices","welcome"].includes(key)?'data-inline-bold-editor':''}><span class="bulletin-field-label">${escape(fields[key])}</span>${["issue","church","website","memoryReference"].includes(key)?
          `<input data-bulletin-field="${key}" value="${escape(fieldValue(doc,key))}" ${key==="issue"?'inputmode="numeric"':''}>`:
          `${["news","outline","notices","welcome"].includes(key)?'<button type="button" data-inline-bold-button aria-label="선택한 문구 굵게" title="굵게 (⌘B / Ctrl+B)"><b>B</b></button>':''}<textarea ${["news","outline","notices","welcome"].includes(key)?'data-inline-bold':''} data-bulletin-field="${key}" ${key==="news"?'data-announcement-numbered aria-describedby="bulletin-news-help"':''} rows="1">${escape(fieldValue(doc,key))}</textarea>`}${key==="news"?'<small id="bulletin-news-help" class="bulletin-input-help">Enter 다음 번호 · Shift+Enter 이어 쓰기</small>':''}</label>`;
        const modern=["editorial","simple"].includes(doc.settings.design);
        if(templateSession){
          p.innerHTML=`<section class="bulletin-property-section"><h3>2027 청년부 공통 문구</h3><p class="bulletin-help">새 주보에 사용할 문구입니다.</p>${profileKeys.map(field).join("")}</section>`;
          fitInputs();return;
        }
        p.innerHTML=`${!child&&options.loadTemplate?`<div class="bulletin-connected"><strong>2027 청년부 공통 양식</strong><button type="button" data-bulletin-template-apply title="이번 주 내용은 유지하고 배치·공통 문구를 가져옵니다.">최신 공통 양식 가져오기</button></div>`:""}${!child&&doc.settings.design!=="simple"?'<button type="button" data-bulletin-use-simple title="내용은 유지하고 배치만 바꿉니다.">새 청년부 양식 적용</button>':""}${modern?`<div class="bulletin-connected"><span>예배에서 연결됨</span><strong>${escape(doc.source?.sermon||"설교 제목 미입력")}</strong><small>${escape(doc.source?.scripture||"본문 미입력")}</small></div>`:""}<section class="bulletin-property-section"><h3>이번 주 편집</h3>${doc.source?.hasArchiveReference?`<label><input type="checkbox" data-bulletin-setting="archiveReference" ${doc.settings.archiveReference!==false?"checked":""}> 발행 원본의 담당·요점·위원표 사용</label>`:""}${(child?["news","memoryVerse","memoryReference","readingPlan","leader","issue"]:modern?["news","outline"]:["news","outline","leader","issue"]).map(field).join("")}<details class="bulletin-property-section" data-bulletin-section="weekly"><summary>담당·발행 정보</summary>${(child?["announcer"]:modern?["leader","issue","announcer","sermonReference","outlineTitle"]:["announcer","sermonReference","outlineTitle"]).map(field).join("")}</details></section>
          ${modern?`<details class="bulletin-property-section" data-bulletin-section="greetings"><summary>환영 문구 · 정기 안내</summary><p class="bulletin-help">${doc.settings.templateKey?"이번 주에만 적용됩니다.":"새 주보에도 이어지는 문구입니다."}</p>${field("welcome")}${field("notices")}</details>`:""}
          <details class="bulletin-property-section" data-bulletin-section="monthly" ${modern?"":"open"}><summary>이번 달 · ${child?"일정과 주제":"일정과 위원"}</summary><p class="bulletin-help">일정 변경은 같은 달의 새 주보에도 적용됩니다.</p>${child?field("monthlyTheme"):""}${field("eventsText")}<button type="button" data-bulletin-calendar-events>교회력 일정 불러오기</button><div class="bulletin-number-grid">
          <label>교회 일정<input type="month" data-bulletin-setting="eventsMonth" value="${escape(doc.settings.eventsMonth||doc.source?.eventsMonth||"")}"></label>
          ${child?"":`<label>예배 위원<input type="month" data-bulletin-setting="rosterMonth" value="${escape(doc.settings.rosterMonth||doc.source?.rosterMonth||"")}"></label>`}</div></details>
          <details class="bulletin-property-section" data-bulletin-common data-bulletin-section="common"><summary>공동체 · 공통 정보</summary><p class="bulletin-help">${doc.settings.templateKey?"이번 주에만 적용됩니다.":"새 주보에도 이어지는 정보입니다."}</p><button type="button" data-bulletin-common-reset>공통 내용 다시 연결</button>${profileKeys.filter(key=>(!child||key!=="brand")&&(!modern||!["welcome","notices"].includes(key))).map(field).join("")}</details>`;

      } else {
        const f=doc.frames.find(f=>f.id===selected)||doc.frames[0];selected=f.id;
        p.innerHTML=`${templateSession?'<h3>2027 청년부 공통 양식</h3><p class="bulletin-help">새 주보에 사용할 양식입니다.</p><button type="button" data-bulletin-template-reload>공통 저장본 다시 불러오기</button>':""}${doc.settings.design==="simple"?`<div class="bulletin-number-grid">${[["lineHeight","줄간격",1.55,1.2,1.9,.05],["itemGap","광고 항목 간격 (mm)",3.5,1,8,.5],["orderPadding","예배 행 여백 (mm)",3,1,5,.5]].map(([k,label,fallback,min,max,step])=>`<label>${label}<input type="number" data-bulletin-setting="${k}" value="${doc.settings[k]??fallback}" min="${min}" max="${max}" step="${step}"></label>`).join("")}</div>`:""}<button type="button" data-bulletin-reset-layout title="문구는 유지하고 기본 배치로 되돌립니다.">배치 초기화</button><label>배경<select data-bulletin-setting="theme"><option value="auto" ${backgroundKey(doc.settings.theme)==="auto"?"selected":""}>자동 · 날짜/부서</option><option value="" ${doc.settings.theme===""?"selected":""}>배경 없음</option>${(doc.backgrounds||[]).map(({key})=>`<option value="${escape(key)}" ${backgroundKey(doc.settings.theme)===key?"selected":""}>${escape(key)}</option>`).join("")}${doc.settings.theme&&doc.settings.theme!=="auto"&&!(doc.backgrounds||[]).some(b=>b.key===backgroundKey(doc.settings.theme))?`<option value="${escape(doc.settings.theme)}" selected>기존 초안: ${escape(backgroundKey(doc.settings.theme))}</option>`:""}</select></label><label><input type="checkbox" data-bulletin-setting="compactOrder" ${doc.settings.compactOrder?"checked":""}> 인쇄용 순서로 간추리기</label><label>지면<select data-bulletin-setting="design">${(doc.source?.department==="children"?[["children","어린이부 · 2026년"]]:[["simple","청년부 · 담백한 양식"],["editorial","2026년 10월"],["auto","기존 자동 양식"],["ink","연속 지면 · 검정 로고"],["panels","분리 지면 · 물결 로고"]]).map(([value,label])=>`<option value="${value}" ${(doc.settings.design||"auto")===value?"selected":""}>${label}</option>`).join("")}</select></label>${doc.source?.department==="children"?"":`<label>설교 요점 배치<select data-bulletin-setting="outlineColumns"><option value="1" ${(doc.settings.outlineColumns||doc.source?.outlineColumns||1)===1?"selected":""}>한 열</option><option value="2" ${(doc.settings.outlineColumns||doc.source?.outlineColumns)===2?"selected":""}>두 열</option></select></label>`}<label>편집 영역<select data-bulletin-frame>${doc.frames.map(f=>`<option value="${f.id}" ${f.id===selected?"selected":""}>${escape(frameLabel(f.id))} · ${f.page?"안쪽":"겉면"}</option>`).join("")}</select></label>
          <label><input type="checkbox" data-bulletin-hidden ${f.hidden?"":"checked"}> 출력에 표시</label><div class="bulletin-number-grid">`+
          [["x","가로 위치"],["y","세로 위치"],["w","너비"],["h","높이"]].map(([key,label])=>`<label>${label} (mm)<input type="number" step="2.5" data-bulletin-dimension="${key}" ${isFlowFrame(doc,f.id)&&["y","h"].includes(key)?'readonly title="내용에 따라 자동 계산"':""} value="${isFlowFrame(doc,f.id)?Number(simpleFlow(doc).frames.find(item=>item.id===f.id)[key].toFixed(2)):f[key]}"></label>`).join("")+`</div>
          <label>글자 크기 (pt)<select data-bulletin-dimension="size">${[...new Set([...TOKENS.fontSizes,f.size])].sort((a,b)=>a-b).map(n=>`<option ${f.size===n?"selected":""}>${n}</option>`).join("")}</select></label>
          <label>정렬<select data-bulletin-align>${[["left","왼쪽"],["center","가운데"],["right","오른쪽"]].map(([v,t])=>`<option value="${v}" ${f.align===v?"selected":""}>${t}</option>`).join("")}</select></label>
          <details class="bulletin-property-section" data-bulletin-section="layout-help"><summary>편집 도움말</summary><p class="bulletin-help">드래그로 이동하고 모서리로 크기를 조절합니다. 방향키는 2.5mm씩 이동합니다.</p><p class="bulletin-help">광고·안내·일정·섬김이는 내용에 맞춰 자동 배치됩니다.</p><p class="bulletin-help">순서 간추리기는 준비·마침·교제·보조 성구와 고백 전문을 생략하고 같은 순서를 묶습니다.</p>${templateSession?'<p class="bulletin-help">광고·설교는 예시입니다. 11월부터 새 주보에 적용되며, 저장된 주보는 유지됩니다.</p>':""}</details>`;
      }
      p.dataset.documentId=doc.id;
      p.dataset.sectionsReady=String(!!doc.source&&assetLoaded);
      const savedSections=disclosureState.get(doc.id);
      if(savedSections)for(const el of p.querySelectorAll("details[data-bulletin-section]"))if(Object.hasOwn(savedSections,el.dataset.bulletinSection))el.open=savedSections[el.dataset.bulletinSection];
      fitInputs();
    }
    async function load(id,force=false) {
      endDrag();
      q(".bulletin-canvas").replaceChildren();
      issues=new Set();
      const request=++serial;loading=true;assetLoaded=false;error="";saveError="";printError="";drag=null;
      if(!documents.has(id)){
        const fresh=restore(options.scope,id);fresh.id=id;
        if(fresh.hasLocal)fresh.localDraft=snapshot(fresh);
        const recovery=readLocal(fresh.key+":recovery");
        if(isRecord(recovery)&&isRecord(recovery.fields)&&Array.isArray(recovery.frames)
          &&(!fresh.hasLocal||(Number(recovery.savedAt)||0)>fresh.savedAt))fresh.localDraft=normalizeSnapshot(recovery);
        documents.set(id,fresh);
      }
      doc=documents.get(id);saveError=doc.saveError||"";const target=doc;q("[data-bulletin-service]").value=id;properties();status();
      try{
        if(!target.dbLoaded||force){
          if(!options.loadDraft)throw new Error("주보 DB 연결이 필요합니다.");
          const beforeRead=JSON.stringify(snapshot(target));
          if(force&&target.dirty)await retainRecovery(target,snapshot(target));
          const row=await options.loadDraft(id);if(request!==serial||signal.aborted)return;
          if(JSON.stringify(snapshot(target))!==beforeRead)throw Error("불러오는 동안 입력이 바뀌어 현재 입력을 유지했습니다.");
          if(row){
            if(target.localDraft&&!readLocal(target.key+":recovery"))await retainRecovery(target,target.localDraft);
            if(request!==serial||signal.aborted)return;
            if(JSON.stringify(snapshot(target))!==beforeRead)throw Error("초안을 보관하는 동안 입력이 바뀌어 현재 입력을 유지했습니다.");
            applyStored(target,row);
          }else{target.dirty=true;target.revision=0;}
          target.dbLoaded=true;target.saveError="";saveError="";
        }
        const source=await options.loadSource(id,target.settings);if(request!==serial||signal.aborted)return;
        target.source=applySourceSnapshot(source,target.sourceSnapshot);
        if(source.department==="children"&&!target.settings.design&&!target.revision&&!target.hasLocal){target.settings.design="children";target.frames=defaultFrames("children");}
        if(!target.settings.design&&source.date>="2026-10-01"&&!target.revision&&!target.hasLocal){target.settings.design="simple";target.frames=defaultFrames("simple");}
        if(source.department==="young-adult"&&options.loadTemplate&&!target.templateChecked){
          try{
            const row=await options.loadTemplate(TEMPLATE_KEY);if(request!==serial||signal.aborted)return;
            templateRow=row?normalizeTemplate(row):null;templateError="";
            if(templateRow&&!target.revision&&!target.hasLocal&&!target.settings.templateKey&&source.date>=templateRow.effective_from){applyTemplate(target,templateRow);}
          }catch(e){templateError=e.message;}
          target.templateChecked=true;
        }
        if(Object.hasOwn(target.fields,"eventsText")){target.months[source.eventsMonth]=target.fields.eventsText;delete target.fields.eventsText;}
        target.profile=target.revision?{}:loadProfile(source.date);
        // Preserve explicitly saved legacy common copy as ordinary content when migrating.
        if(!target.revision&&!target.settings.templateKey&&source.department!=="children")for(const [key,value] of Object.entries(target.profile))if(!Object.hasOwn(target.fields,key))target.fields[key]=value;
        target.backgrounds=options.getBackgrounds?.()||[];await readyBackground(target);if(request!==serial||signal.aborted)return;assetLoaded=true;
      }catch(e){if(request===serial&&!signal.aborted)error=e.message||"자료를 불러오지 못했습니다.";}
      finally{if(request===serial&&!signal.aborted){loading=false;properties();preview();status();}}
    }
    function history(redo=false){
      if(loading||!doc?.dbLoaded)return;
      const from=redo?doc.future:doc.history,to=redo?doc.history:doc.future;
      if(!from.length)return;const sourceState=JSON.stringify([doc.settings,doc.sourceSnapshot]);to.push(snapshot(doc));Object.assign(doc,from.pop());persist();properties();preview();
      if(!templateSession&&sourceState!==JSON.stringify([doc.settings,doc.sourceSnapshot]))void load(q("[data-bulletin-service]").value);
    }
    function setDimension(f,key,value){
      if(isFlowFrame(doc,f.id)&&["y","h"].includes(key))return;
      if(key==="size"){if(TOKENS.fontSizes.includes(value))f.size=value;return;}
      const origin=key==="x"&&f.x>=TOKENS.fold?TOKENS.fold:0;
      value=snap(value-origin)+origin;
      if(key==="x")f.x=Math.max(0,Math.min(TOKENS.width-f.w,value));
      if(key==="y")f.y=Math.max(0,Math.min(TOKENS.height-f.h,value));
      if(key==="w")f.w=Math.max(10,Math.min(TOKENS.width-f.x,value));
      if(key==="h")f.h=Math.max(5,Math.min(TOKENS.height-f.y,value));
    }
    on(root,"input",event=>{
      const key=event.target.dataset.bulletinField;if(!key)return;
      remember();
      if(key==="eventsText"){doc.months[doc.source.eventsMonth]=event.target.value;delete doc.fields.eventsText;}
      else doc.fields[key]=event.target.value;
      fitInputs();persist();preview();
    });
    on(root,"change",event=>{
      const t=event.target;
      if(t.dataset.bulletinSetting){
        if(["lineHeight","itemGap","orderPadding"].includes(t.dataset.bulletinSetting)){
          if(!t.checkValidity())return;remember();doc.settings[t.dataset.bulletinSetting]=Number(t.value);persist();preview();return;
        }
        const key=t.dataset.bulletinSetting;if(!["theme","design","compactOrder","archiveReference","outlineColumns"].includes(key)&&!validMonth(t.value)){t.value=doc.settings[key]||doc.source?.[key]||"";return;}
        remember();doc.settings[key]=["compactOrder","archiveReference"].includes(key)?t.checked:key==="outlineColumns"?Number(t.value):t.value;
        if(key==="design")doc.frames=defaultFrames(t.value);
        if(["compactOrder","archiveReference"].includes(key))doc.sourceSnapshot=null;
        if(templateSession){persist();properties();preview();return;}
        persist();
        void load(q("[data-bulletin-service]").value);return;
      }
      if(t.matches("[data-bulletin-hidden]")){remember();doc.frames.find(f=>f.id===selected).hidden=!t.checked;persist();preview();return;}
      if(t.matches("[data-bulletin-service]")){if(options.onServiceChange?.(t.value)===false){t.value=doc.id;return;}void load(t.value);return;}
      if(t.matches("[data-bulletin-frame]")){selected=t.value;properties();preview();showPage(doc.frames.find(f=>f.id===selected).page);return;}
      const f=doc.frames.find(f=>f.id===selected);
      if(t.dataset.bulletinDimension){const n=Number(t.value);if(!t.value.trim()||!Number.isFinite(n)){t.value=String(f[t.dataset.bulletinDimension]);return;}remember();setDimension(f,t.dataset.bulletinDimension,n);persist();properties();preview();}
      if(t.matches("[data-bulletin-align]")){remember();f.align=t.value;persist();preview();}
    });
    on(root,"click",async event=>{
      if(mode==="content"){
        const hit=event.target.closest("[data-frame-id]"),frame=hit&&doc?.frames.find(f=>f.id===hit.dataset.frameId);
        if(frame?.binding.startsWith("field:")){
          const input=q(`[data-bulletin-field="${frame.binding.slice(6)}"]`);
          if(input){for(let parent=input.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;input.focus({preventScroll:true});input.scrollIntoView({block:"nearest"});}
        }
      }
      const b=event.target.closest("button");if(!b)return;
      if(b.hasAttribute("data-bulletin-template-edit")){void editTemplate();return;}
      if(b.hasAttribute("data-bulletin-template-reload")){
        if(templateSession){try{const target=doc,before=JSON.stringify(snapshot(target));await retainRecovery(target,snapshot(target));if(doc!==target||JSON.stringify(snapshot(target))!==before)throw Error("입력이 바뀌어 현재 초안을 유지했습니다.");await writeLocal(target,target.key,{version:3,templateDirty:false});if(doc!==target||JSON.stringify(snapshot(target))!==before)throw Error("입력이 바뀌어 현재 초안을 유지했습니다.");exitTemplate();templateDraft=null;void editTemplate();}catch(e){saveError=e.message;status();}}return;
      }
      if(b.hasAttribute("data-bulletin-template-exit")){exitTemplate();return;}
      if(b.hasAttribute("data-bulletin-template-apply")){
        const target=doc;loading=true;status();
        void options.loadTemplate(TEMPLATE_KEY).then(row=>{
          if(doc!==target||signal.aborted)return;if(!row)throw new Error("공통 양식을 먼저 저장해 주세요.");
          row=normalizeTemplate(row);remember();applyTemplate(doc,row);for(const key of profileKeys)delete doc.fields[key];persist();templateError="";
        }).catch(e=>{if(doc===target)saveError=e.message;}).finally(()=>{if(!signal.aborted){loading=false;properties();preview();status();}});return;
      }
      if(b.hasAttribute("data-bulletin-use-simple")){remember();doc.settings.design="simple";doc.frames=defaultFrames("simple");persist();properties();preview();void readyBackground(doc).then(()=>{assetLoaded=true;preview();});return;}
      if(b.hasAttribute("data-bulletin-reset-layout")){remember();doc.frames=defaultFrames(doc.settings.design);persist();properties();preview();return;}
      if(b.hasAttribute("data-bulletin-calendar-events")){
        remember();doc.months[doc.source.eventsMonth]=doc.source.calendarEvents||"";delete doc.fields.eventsText;
        persist();properties();preview();return;
      }
      if(b.hasAttribute("data-bulletin-common-reset")){
        if(doc.settings.templateKey){saveError="공통 양식 문구는 최신 공통 양식 가져오기로 다시 연결해 주세요.";status();return;}
        remember();for(const key of profileKeys)delete doc.fields[key];doc.inherited.common={};
        persist();properties();preview();return;
      }
      if(b.hasAttribute("data-bulletin-save")){void save();return;}
      if(b.hasAttribute("data-bulletin-reload")){void load(doc.id,true);return;}
      if(b.hasAttribute("data-bulletin-local")){
        reviewLocalDraft();return;
      }
      if(b.dataset.bulletinMode){mode=b.dataset.bulletinMode;properties();preview();}
      if(b.hasAttribute("data-bulletin-refresh")){remember();doc.inherited={common:doc.settings.templateKey?doc.inherited.common:{},months:{}};doc.sourceSnapshot=null;doc.settings.archiveReference=false;persist();void load(q("[data-bulletin-service]").value);}
      if(b.hasAttribute("data-bulletin-undo"))history();
      if(b.hasAttribute("data-bulletin-redo"))history(true);
      if(b.hasAttribute("data-bulletin-print"))void print();
    });
    let drag=null;
    on(root,"pointerdown",event=>{
      const hit=event.target.closest("[data-frame-hit],[data-resize]");if(loading||!doc?.dbLoaded||!hit||mode!=="layout"||event.button!==0)return;
      event.preventDefault();selected=hit.dataset.frameHit||hit.dataset.resize;
      const f=doc.frames.find(f=>f.id===selected),rect=hit.closest("svg").getBoundingClientRect();
      drag={before:snapshot(doc),frame:clone(f),clientX:event.clientX,clientY:event.clientY,scale:297/rect.width,resize:!!hit.dataset.resize};
      properties();preview();q(".bulletin-canvas").focus();
    });
    on(document,"pointermove",event=>{
      if(loading||!drag||!root.isConnected)return;
      const f=doc.frames.find(f=>f.id===selected),dx=(event.clientX-drag.clientX)*drag.scale,dy=(event.clientY-drag.clientY)*drag.scale;
      setDimension(f,drag.resize?"w":"x",drag.frame[drag.resize?"w":"x"]+dx);
      setDimension(f,drag.resize?"h":"y",drag.frame[drag.resize?"h":"y"]+dy);
      preview();
    });
    function endDrag(){if(!drag)return;if(JSON.stringify(drag.before)!==JSON.stringify(snapshot(doc))){remember(drag.before);persist();}drag=null;properties();preview();}
    on(document,"pointerup",endDrag);on(document,"pointercancel",endDrag);
    on(root,"keydown",event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();event.stopPropagation();void save();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="p"){event.preventDefault();event.stopPropagation();void print();return;}
      if(event.target.matches("input,textarea,select"))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.stopPropagation();history(event.shiftKey);return;}
      if(!event.target.closest(".bulletin-canvas")||loading||!doc?.dbLoaded||mode!=="layout"||!selected||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();event.stopPropagation();remember();const f=doc.frames.find(f=>f.id===selected),step=event.shiftKey?10:2.5;
      if(event.key==="ArrowLeft")setDimension(f,"x",f.x-step);if(event.key==="ArrowRight")setDimension(f,"x",f.x+step);
      if(event.key==="ArrowUp")setDimension(f,"y",f.y-step);if(event.key==="ArrowDown")setDimension(f,"y",f.y+step);
      persist();properties();preview();
    });
    let printFrame,printSession=false;
    async function print(){
      if(q("[data-bulletin-print]").disabled)return;
      endDrag();
      printing=true;printError="";status();
      const output={...snapshot(doc),profile:clone(doc.profile),source:clone(doc.source),backgrounds:clone(doc.backgrounds)};
      try{
        await readyBackground(output);
        if(signal.aborted)return;
        const rendered=renderPages(output,"print",null);if(rendered.issues.size)throw new Error("내용이 편집 영역을 넘습니다. 크기나 간격을 조정해 주세요.");
        printFrame?.remove();printFrame=document.createElement("iframe");
        printFrame.title="주보 인쇄";printFrame.className="bulletin-print-frame";
        const fontCSS=[[500,"5Medium"],[700,"7Bold"],[800,"8ExtraBold"]].map(([w,n])=>`@font-face{font-family:MindexBulletin;font-weight:${w};src:url('${new URL(`vendor/fonts/freesentation/Freesentation-${n}.woff2`,document.baseURI)}')}`).join("");
        const frame=printFrame;
        const loaded=new Promise(resolve=>{
          const abort=()=>resolve(false);
          signal.addEventListener("abort",abort,{once:true});
          frame.onload=()=>{signal.removeEventListener("abort",abort);resolve(true);};
        });
        printFrame.srcdoc=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>주보 ${escape(output.source.date)}</title><style>${fontCSS}@page{size:297mm 210mm;margin:0}body{margin:0}svg{display:block;width:297mm;height:210mm;break-after:page}svg:last-child{break-after:auto}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style><body>${rendered.pages.map(p=>p.outerHTML).join("")}</body></html>`;
        document.body.append(frame);if(!await loaded||signal.aborted)return;
        await Promise.all([500,700,800].map(w=>frame.contentDocument.fonts.load(`${w} 12.5pt MindexBulletin`)));
        await frame.contentDocument.fonts.ready;
        if(signal.aborted||!frame.isConnected)return;
        printSession=true;
        frame.contentWindow.addEventListener("afterprint",()=>{printSession=false;},{once:true});
        frame.contentWindow.focus();frame.contentWindow.print();
      }catch(e){printSession=false;if(!signal.aborted)printError=e.message;}
      finally{printing=false;if(!signal.aborted)status();}
    }
    const observer=new MutationObserver(()=>{if(!root.isConnected)destroy();});
    observer.observe(document.body,{childList:true,subtree:true});
    function destroy(){endDrag();serial++;controller.abort();observer.disconnect();previewResize.disconnect();inputResize.disconnect();printFrame?.remove();}

    // Build the remote document off-screen; recheck every edit/interaction guard before adoption.
    let remoteBusy=false,interactionRevision=0;
    for(const event of ["input","change","pointerdown","keydown"])on(root,event,()=>interactionRevision++);
    const remoteBlocked=()=>signal.aborted||!root.isConnected||!doc||loading||printing||printSession||drag||doc.dirty||doc.saving||!!doc.saveError||!!error
      ||root.contains(document.activeElement)&&document.activeElement.matches("input,textarea,select,[contenteditable]")||options.remoteBlocked?.();
    async function refreshRemote(kind,id){
      if(remoteBusy||remoteBlocked())return false;
      const isTemplate=!!templateSession;
      if(kind!== (isTemplate?"bulletin-template":"bulletin")||id!==(isTemplate?TEMPLATE_KEY:q("[data-bulletin-service]").value))return false;
      const target=doc,request=serial,edit=interactionRevision,before=JSON.stringify(snapshot(target));
      remoteBusy=true;
      try{
        const row=await (isTemplate?options.loadTemplate(id):options.loadDraft(id));
        const stale=()=>remoteBlocked()||doc!==target||request!==serial||edit!==interactionRevision||JSON.stringify(snapshot(target))!==before;
        if(stale())return false;
        if(!row)return true; // A deletion never erases the visible document.
        if(Number(row.revision)<=Number(target.revision))return true;
        const next={...target,...normalizeSnapshot(snapshot(target))};
        if(isTemplate){const value=normalizeTemplate(row);applyTemplate(next,value);next.fields={...value.common};next.revision=value.revision;next.history=[];next.future=[];next.dirty=false;}
        else{applyStored(next,row);next.source=applySourceSnapshot(await options.loadSource(id,next.settings),next.sourceSnapshot);next.profile={};}
        await readyBackground(next);
        if(stale())return false;
        const positions=[".bulletin-canvas",".bulletin-inspector"].map(selector=>[selector,q(selector).scrollTop,q(selector).scrollLeft]);
        Object.assign(target,next);if(isTemplate)templateRow=normalizeTemplate(row);
        backup(target);properties();preview();status();
        for(const [selector,top,left] of positions){q(selector).scrollTop=top;q(selector).scrollLeft=left;}
        return true;
      }finally{remoteBusy=false;}
    }
    function remoteIdentity(){return doc?{kind:templateSession?"bulletin-template":"bulletin",recordId:templateSession?TEMPLATE_KEY:q("[data-bulletin-service]").value}:null;}
    void load(options.serviceId);
    function handoffIdentity(){const id=remoteIdentity();return id?{kind:id.kind,id:id.recordId}:null;}
    async function restoreHandoff(draft){
      if(draft?.schema===1&&draftSignature(draft.value)===draftSignature(doc))return false;
      if(!draft||draft.schema!==1||remoteBlocked()){saveError='현재 입력·저장·인쇄를 마친 뒤 초안을 이어 써 주세요.';status();return false;}
      const changed=draft.revision!==doc.revision;
      if(!window.confirm(changed?'초안을 만든 뒤 저장본이 바뀌었습니다. 현재 내용과 가져올 초안을 각각 보관하고, 가져온 초안으로 편집창을 바꿀까요? 저장본은 바뀌지 않습니다.':'연결된 기기의 주보 초안을 편집창에 불러올까요?'))return false;
      const target=doc,request=serial,edit=interactionRevision,before=JSON.stringify(snapshot(target));
      try{
        await writeLocal(target,target.key+":handoff-recovery:"+crypto.randomUUID(),{schema:1,current:snapshot(target),incoming:structuredClone(draft),savedAt:Date.now()});
        await retainRecovery(target,snapshot(target));
        if(remoteBlocked()||doc!==target||serial!==request||edit!==interactionRevision||JSON.stringify(snapshot(target))!==before)return false;
        remember();Object.assign(target,normalizeSnapshot(draft.value));persist();properties();preview();status();return true;
      }catch(e){saveError=e.message;status();return false;}
    }
    return {matchesDraft:draft=>!!doc&&draft?.schema===1&&draftSignature(draft.value)===draftSignature(doc),destroy, refreshRemote, remoteIdentity,handoffIdentity,restoreHandoff, reload(){return load(q("[data-bulletin-service]").value);}};
  }
  window.MindexBulletin=Object.freeze({mount,resolveSource,reusableContent,fieldValue,defaultFrames,renderPages,readyAssets,TOKENS,wrap,profileForDate,monthlyView,storedValue,applyStored,normalizeSnapshot,applySourceSnapshot,templateValue,normalizeTemplate,applyTemplate,TEMPLATE_KEY});
})();
