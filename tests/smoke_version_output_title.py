"""Offline title save/reload and output; no production or native output."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ['chromium','webkit']:
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
    page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
    page.goto(url+'?output=presenter',wait_until='domcontentloaded')
    page.wait_for_function("typeof songOutputTitle==='function'")
    print(engine,page.evaluate('''() => {
      const check=(v,m)=>{if(!v)throw Error(m)};
      const song={id:'test-song',title:'대표 제목',original_title:'Original',memo:null,scripture:[],metadata:{},related_song_ids:[],_relationalVersionsLoaded:true,versions:[{id:'ko',name:'기본',forms:[]},{id:'en',name:'English',forms:[{id:'f',part_type:'Verse',label:'Verse 1',lyrics:'Saved lyrics',sort_order:1}]}]};
      song.versions=normalizeSongVersions(song,song.versions);
      check(songOutputTitle(song,song.versions[1])==='대표 제목','English must not guess');
      song.versions[1].output_title='  English Title  ';
      const before=JSON.stringify(song.versions[1].forms);
      const memo=serializeSongMemo(song,{omitVersions:true});
      check(!JSON.parse(memo).versions,'must not duplicate lyric payload');
      const reopened={...song,memo,versions:[]};
      attachRelationalSongVersionRows([{id:'ko',source_song_id:song.id,curated_version_name:'기본',version_order:1},{id:'en',source_song_id:song.id,curated_version_name:'English',version_order:2}],[{id:'f',version_id:'en',text:'Saved lyrics',unit_kind:'Verse',curated_unit_label:'Verse 1',curated_order:1}],null,[reopened]);
      check(songOutputTitle(reopened,reopened.versions[1])==='English Title','reload title');
      check(presenterSongTitleDisplayTitle(reopened,reopened.versions[1])==='English Title','presenter title');
      check(presenterPraiseElementTitle(reopened,reopened.versions[1]).startsWith('English Title'),'element title');
      check(songOutputTitle(reopened,reopened.versions[0])==='대표 제목','other version');
      check(reopened.versions[1].forms[0].lyrics==='Saved lyrics','lyrics preserved');
      check(JSON.stringify(song.versions[1].forms)===before,'source forms mutated');
      reopened.versions[1].output_title='';
      const cleared=serializeSongMemo(reopened,{omitVersions:true});
      check(!JSON.parse(cleared||'{}').versionOutputTitles,'clear persists');
      const legacy=JSON.parse(serializeSongMemo(song));
      check(legacy.versions[1].output_title==='English Title','memo-only version persistence');
      const unloaded={...song,memo,versions:[{id:song.id,name:'기본'}],_relationalVersionsLoaded:false};
      check(JSON.parse(serializeSongMemo(unloaded,{omitVersions:true})).versionOutputTitles.en==='English Title','lazy metadata save retention');
      const hymn={title:'대표 찬송 제목',hymn_no:'251'};
      check(presenterSongTitleDisplayTitle(hymn,{hymn_no:'통 137',output_title:'판본 제목'})==='통 137 판본 제목','hymn uses explicit title');
      check(presenterSongTitleDisplayTitle(hymn,{hymn_no:'통 137'})==='통 137 대표 찬송 제목','hymn defaults');
      state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId='en';
      updateSaveState=()=>{}; // Output-only fixture has no application toolbar.
      document.body.innerHTML='<div id="fixture">'+renderVersionTitleContent(song,song.versions[1],song.versions[1].forms,{active:true})+'</div>';
      return {saved:true,reopened:true,cleared:true,lyricsPreserved:true};
    }'''),flush=True)
    field=page.locator('[data-version-output-title-field="en"]')
    field.fill('Updated title')
    page.evaluate("updateVersionOutputTitleField(document.querySelector('[data-version-output-title-field=\"en\"]'))")
    assert page.evaluate("state.songs[0].versions[1].output_title")=='Updated title'
    assert page.evaluate("state.selectedVersionId")=='en'
    page.evaluate("""async () => {
      const song=state.songs[0];state.songVersionTablesSupported=true;state.dirty.forms=false;
      saveSongRelationsIfAvailable=async()=>false;
      const writes=[];
      state.client={from(table){if(table!=='mindex_songs')throw Error('unexpected table '+table);let payload;const q={update(p){payload=p;return q},eq(){return q},is(){return q},select(){return q},async single(){writes.push(payload);return {data:{id:song.id,...payload},error:null}}};return q}};
      const versions=JSON.stringify(song.versions);
      await saveSongMeta(song);
      if(writes.length!==1 || JSON.parse(writes[0].memo).versionOutputTitles.en!=='Updated title')throw Error('save path');
      if(song.versions[1].id!=='en' || song.versions[1].output_title!=='Updated title')throw Error('saved identity/title');
      const fresh=normalizeServerSong({id:song.id,...writes[0]});
      attachRelationalSongVersionRows([{id:'en',source_song_id:song.id,curated_version_name:'English',version_order:2}],[],null,[fresh]);
      if(songOutputTitle(fresh,fresh.versions[0])!=='Updated title')throw Error('fresh save reopen');
    }""")
    browser.close()
 finally:server.shutdown()
if __name__=='__main__':main()
