/* Verified edition history is separate from the identity of the installed text. */
(() => {
  const editions = [
  {
    "id": "t01",
    "dbTranslationId": "bb12533e-261e-492b-914d-c745ff2acedc",
    "name": "KJV",
    "history": "1611년 초판 · 1769년 개정 계열",
    "textEdition": "CrossWire KJV 3.1 · 모듈 연혁 2023-06-30",
    "printingStatus": "unconfirmed",
    "note": "전자 모듈 버전은 확인됐으며 특정 인쇄본의 전사본으로 보증하지 않습니다.",
    "source": "https://gitlab.com/crosswire-bible-society/kjv",
    "historySource": "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV",
    "retrievedAt": "2026-10-14"
  },
  {
    "id": "t04",
    "dbTranslationId": "dbf38d4d-3c8f-4407-a2dc-ca6af3233277",
    "name": "개역개정",
    "revisionSource": "https://lib.bskorea.or.kr/library/10110/contents/7626057",
    "history": "1998년 초판 · 2005년 제4판 발행",
    "textEdition": "대한성서공회 GAE 전자본문",
    "printingStatus": "unconfirmed",
    "note": "제4판의 발행 연혁과 현재 전자본문의 특정 인쇄 판차 일치는 구분합니다. 현재 인쇄 판차 및 수정 연도는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-14"
  },
  {
    "id": "t05",
    "dbTranslationId": "213dfb63-34bc-491d-90fb-6c57ab20dd3e",
    "name": "개역한글",
    "history": "1961년 결정판 발행",
    "textEdition": "대한성서공회 HAN 전자본문",
    "printingStatus": "unconfirmed",
    "note": "현재 전자본문에 대응하는 인쇄 쇄차는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=HAN",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-15"
  },
  {
    "id": "t08",
    "dbTranslationId": "e1a705f1-4579-49ea-976f-3ed3914506d5",
    "name": "쉬운성경",
    "history": "2001년 첫 출간",
    "textEdition": "GODpia 전자본문 · 아가페 안내 경로",
    "printingStatus": "unconfirmed",
    "note": "현재 전자본문의 개정 연도와 인쇄 판차는 미확인입니다.",
    "source": "https://www.godpia.com/read/reading.asp?ver=easy",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-14"
  },
  {
    "id": "t10",
    "dbTranslationId": "555482f7-28c5-437d-b958-ac2f5f800705",
    "name": "표준새번역",
    "history": "1993년 초판 발행",
    "textEdition": "대한성서공회 SAE 전자본문",
    "printingStatus": "unconfirmed",
    "note": "2001년 새번역과 별개인 역본입니다. 현재 인쇄 쇄차는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=SAE",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-14"
  },
  {
    "id": "t14",
    "dbTranslationId": "129a9967-37f9-5119-b86a-a74d9efa0e31",
    "name": "공동번역",
    "history": "1977년 초판 발행",
    "textEdition": "대한성서공회 COG 전자본문",
    "printingStatus": "unconfirmed",
    "note": "현재 전자본문에 대응하는 인쇄 쇄차는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=COG",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-16"
  },
  {
    "id": "t15",
    "dbTranslationId": "26f5cbf7-4155-5b2b-bb3f-6bbd7e8b140f",
    "name": "공동번역 개정판",
    "history": "1999년 개정판 발행",
    "textEdition": "대한성서공회 COGNEW 전자본문",
    "printingStatus": "unconfirmed",
    "note": "현재 전자본문에 대응하는 인쇄 쇄차는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=COGNEW",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-16"
  },
  {
    "id": "t16",
    "dbTranslationId": "412ca3d7-d3b0-5094-8895-ce6df2be78e4",
    "name": "새번역",
    "history": "2001년 초판 발행",
    "textEdition": "대한성서공회 SAENEW 전자본문",
    "printingStatus": "unconfirmed",
    "note": "현재 전자본문에 대응하는 인쇄 쇄차는 미확인입니다.",
    "source": "https://www.bskorea.or.kr/bible/korbibReadpage.php?version=SAENEW",
    "historySource": "https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=pc&wr_id=3",
    "retrievedAt": "2026-10-16"
  },
  {
    "id": "t18",
    "dbTranslationId": "e4d5a42f-1205-54ca-bffa-a67672f70c31",
    "name": "ASV",
    "history": "1901년 ASV",
    "textEdition": "American Standard Version1901 · eBible electronic edition",
    "printingStatus": "electronic-source",
    "note": "공식 USFM·USFX 전 구절 대조 완료. 같은 전자본문의 두 형식 대조이며 인쇄본 대조는 아닙니다.",
    "source": "https://ebible.org/details.php?id=eng-asv",
    "historySource": "https://ebible.org/details.php?id=eng-asv",
    "retrievedAt": "2026-10-16"
  },
  {
    "id": "t19",
    "dbTranslationId": "8c1d475e-6f0e-51b2-be66-2312358459d5",
    "name": "WEB Classic",
    "history": "2020년 WEB Classic 안정판",
    "textEdition": "World English Bible Classic2020stable · eBible electronic edition",
    "printingStatus": "electronic-source",
    "note": "공식 USFM·USFX 전 구절 대조 완료. 같은 전자본문의 두 형식 대조이며 인쇄본 대조는 아닙니다.",
    "source": "https://ebible.org/details.php?id=eng-web",
    "historySource": "https://ebible.org/details.php?id=eng-web",
    "retrievedAt": "2026-10-16"
  }
];
  window.BibleEditionInfo = Object.freeze({
    get(translation) {
      const id = translation?.dbTranslationId || translation?.id;
      return editions.find(e => e.dbTranslationId === id || e.id === id) || null;
    }
  });
})();
