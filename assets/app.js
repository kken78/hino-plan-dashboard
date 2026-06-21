/* ===== 第6次日野町総合計画 進捗ダッシュボード ===== */
(function(){
  const PC = {}; KPI.pillars.forEach(p=>PC[p.id]=p);
  const fmt = n => n==null ? '—' : n.toLocaleString('ja-JP');
  const yen = t => { // 千円単位の値を 億円／万円 で読みやすく
    if(t==null) return '—';
    if(t>=100000){ // 1億円以上（=100,000千円）
      const oku=t/100000;
      const s=(oku>=100?oku.toFixed(0):oku.toFixed(1)).replace(/\.0$/,'');
      return s+'<small>億円</small>';
    }
    if(t>=10) return Math.round(t/10).toLocaleString('ja-JP')+'<small>万円</small>'; // 1万円以上（=10千円）
    return fmt(t)+'<small>千円</small>';
  };
  const plainYen = t => yen(t).replace(/<[^>]+>/g,''); // aria-label用（HTMLタグ除去）
  const pillarTotals = ()=>{const m={};KPI.pillars.forEach(p=>m[p.id]=0);
    PLAN.fields.forEach(f=>{const pid=KPI.fields.find(k=>k.id===f.id).pillar; m[pid]+=f.total;});return m;};

  /* 達成度（向き考慮）: 基準→中間目標 をゴールとし、現在地は持っていないので
     「目標が基準からどれだけ改善方向に動くか＝目標の野心度」を中間目標到達=100%として表示する。
     現状値が無いため、ここでは基準値→R7目標の進捗バーは『目標の位置』を示す。 */
  function targetProgress(ind){
    // 改善方向に向けて 基準→最終目標 のスパンの中で 中間目標(R7)がどこか（％）
    const b=ind.baseline, mid=ind.target_mid, fin=ind.target_final;
    if(b==null||fin==null) return null;
    const span = fin-b;
    if(span===0) return {midPct:100, note:'維持目標'};
    const midPct = Math.max(0,Math.min(100, Math.abs((mid-b)/span)*100));
    return {midPct};
  }
  function dirLabel(d){return d==='up'?'増加で改善':d==='down'?'減少で改善':'維持・中立';}
  function dirArrow(d){return d==='up'?'▲':d==='down'?'▼':'＝';}
  /* 方向は「改善の向き」を示す情報であり、良し悪しの状態ではない。
     状態色（緑＝良/赤＝悪）を当てると誤解を生むため、矢印＋文言＋中立色で表現する。
     セマンティック色（success/error）は、実績値が入り達成/未達が判定できる段階で導入する。 */

  /* ---------- 概要タブ ---------- */
  function renderOverview(){
    const el=document.getElementById('p-overview');
    let kpiCount=0, kpiFields=0;
    KPI.fields.forEach(f=>{ if(f.indicators.length){kpiFields++; kpiCount+=f.indicators.length;} });
    const budget=PLAN.fields.reduce((a,f)=>a+f.total,0);
    const pt=pillarTotals();
    const maxPt=Math.max(...Object.values(pt));
    el.innerHTML = `
      <h2 class="sec">計画のいま（令和7年度＝10年計画の5年目・中間年）</h2>
      <p class="lead">第6次総合計画は令和3〜12年度の10年計画。今年度は中間目標（R7）の評価年にあたります。3つの情報源を34分野で横断します。まず全体像を示し、各タブで詳細に辿れる構成です。</p>
      <div class="stats">
        <div class="stat highlight"><div class="k">計画の進捗（経過年）</div><div class="v">5<small>/10年目</small></div><div class="note">R3〜R12・中間目標(R7)の評価年</div></div>
        <div class="stat"><div class="k">成果指標(KPI)</div><div class="v">${kpiCount}<small>指標</small></div><div class="note">${kpiFields}/34分野で設定</div></div>
        <div class="stat"><div class="k">実施計画 事業費（R7-R9・3年計）</div><div class="v">${yen(budget)}</div><div class="note">概算事業費の合計</div></div>
        <div class="stat"><div class="k">住民意識調査 回収率（R6）</div><div class="v">${SURVEY.meta.survey.response_rate}<small>%</small></div><div class="note">有効回答 ${fmt(SURVEY.meta.survey.responses)}件</div></div>
        <div class="stat"><div class="k">幸福度 平均（R6・10点満点）</div><div class="v">${SURVEY.happiness.average}<small>/10点</small></div><div class="note">6点以上が6割超</div></div>
      </div>

      <h2 class="sec">政策の柱別 事業費（実施計画 R7-R9・3年計）</h2>
      <p class="lead">5つの政策の柱ごとに、実施計画の概算事業費（3年計）を比較しています。色は政策の柱（凡例と対応）。</p>
      <div class="pillars">
        ${KPI.pillars.map(p=>`<span class="pill"><span class="dot" style="background:${p.color}"></span>${p.id}. ${p.name}</span>`).join('')}
      </div>
      <div class="card2">
        ${KPI.pillars.map(p=>`
          <div class="budrow">
            <div class="bn">${p.id}. ${p.name}</div>
            <div class="bb"><span style="width:${(pt[p.id]/maxPt*100).toFixed(1)}%;background:${p.color}" role="img" aria-label="${p.name} 事業費 ${plainYen(pt[p.id])}"></span></div>
            <div class="bv">${yen(pt[p.id])}</div>
          </div>`).join('')}
      </div>

      <p class="lead" style="margin-top:18px">
        ※ 各タブで詳細を確認できます。<b>KPI・進捗</b>＝分野別の成果指標と目標、<b>実施計画</b>＝事業と予算、<b>住民の声</b>＝意識調査の結果。
      </p>`;
  }

  /* ---------- KPIタブ ---------- */
  let kpiFilter=0; // 0=全部
  function renderKpi(){
    const el=document.getElementById('p-kpi');
    const fields = KPI.fields.filter(f=> kpiFilter===0 || f.pillar===kpiFilter);
    const chips = `<div class="filterbar"><span class="fl">政策の柱で絞り込み：</span>
      <button class="chip" data-pf="0" aria-pressed="${kpiFilter===0}">すべて</button>
      ${KPI.pillars.map(p=>`<button class="chip" data-pf="${p.id}" aria-pressed="${kpiFilter===p.id}"><span class="cdot" style="background:${p.color}"></span>${p.id}. ${p.name}</button>`).join('')}
    </div>`;
    const cards = fields.map(f=>{
      const c=PC[f.pillar].color;
      let inner;
      if(!f.indicators.length){
        inner=`<div class="no-kpi">この分野は数値目標（成果指標）が設定されていません。<br><span>主な取組のみ</span></div>`;
      } else {
        inner=f.indicators.map(ind=>{
          const tp=targetProgress(ind);
          const w = tp? tp.midPct : 0;
          const aria=`${ind.name}。基準${fmt(ind.baseline)}${ind.unit}（${ind.baseline_year}）、中間目標${fmt(ind.target_mid)}${ind.unit}、最終目標${fmt(ind.target_final)}${ind.unit}、${dirLabel(ind.direction)}`;
          return `<div class="ind">
            <div class="iname">${ind.name}<span class="dirtag" title="改善の向き"><span class="ar">${dirArrow(ind.direction)}</span>${dirLabel(ind.direction)}</span></div>
            <div class="bar" role="img" aria-label="${aria}"><span style="width:${w.toFixed(0)}%"></span></div>
            <div class="barends"><span>基準</span><span>最終目標(R12)</span></div>
            <div class="barmeta">
              <span>基準 <b>${fmt(ind.baseline)}${ind.unit}</b> <small>(${ind.baseline_year})</small></span>
              <span>中間(R7) <b>${fmt(ind.target_mid)}${ind.unit}</b> → 最終(R12) <b>${fmt(ind.target_final)}${ind.unit}</b></span>
            </div>
          </div>`;
        }).join('');
      }
      return `<div class="fcard">
        <div class="top" style="border-left-color:${c}">
          <div class="fid">分野 ${f.id}　|　${PC[f.pillar].name}</div>
          <div class="fname">${f.name}</div>
          <div class="fpolicy">${f.policy}</div>
        </div>
        <div class="body">${inner}</div>
      </div>`;
    }).join('');
    el.innerHTML=`
      <h2 class="sec">KPI・進捗 — 分野別の成果指標（基本計画）</h2>
      <p class="lead">バーは、各指標の <b>基準値</b> から <b>最終目標(R12)</b> までを区間としたときに、<b>中間目標(R7)</b> がどこに位置するか（目標の置き方）を示します。バーは目標の位置であり、実績の進捗ではありません。改善の向きは指標ごとに異なるため、矢印と文言で示しています（▲増加で改善 ／ ▼減少で改善 ／ ＝維持・中立）。実績値が公表されれば、達成度（達成／未達）を色で重ねられます。基準値の年次は分野により異なります（各指標に併記）。</p>
      ${chips}
      <div class="grid">${cards}</div>`;
    el.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{kpiFilter=+b.dataset.pf; renderKpi(); animateBars(el);});
    animateBars(el);
  }

  /* ---------- 実施計画タブ ---------- */
  function renderPlan(){
    const el=document.getElementById('p-plan');
    const fields=[...PLAN.fields].filter(f=>f.total>0).sort((a,b)=>b.total-a.total);
    const max=Math.max(...fields.map(f=>f.total));
    const total=PLAN.fields.reduce((a,f)=>a+f.total,0);
    const rows=fields.map(f=>{
      const pid=KPI.fields.find(k=>k.id===f.id).pillar;
      return `<div class="budrow">
        <div class="bn">${f.id}. ${f.name}<small>${PC[pid].name}</small></div>
        <div class="bb"><span style="width:${(f.total/max*100).toFixed(1)}%" role="img" aria-label="${f.name} 概算事業費 ${plainYen(f.total)}"></span></div>
        <div class="bv">${yen(f.total)}</div>
      </div>`;
    }).join('');
    // 主要事業 上位
    const allEv=[];
    PLAN.fields.forEach(f=>f.events.forEach(e=>allEv.push({...e,field:f.name,id:f.id})));
    allEv.sort((a,b)=>b.cost-a.cost);
    const top=allEv.slice(0,12);
    const maxe=top[0].cost;
    const evrows=top.map(e=>{
      return `<div class="budrow">
        <div class="bn">${e.name}<small>分野${e.id} ${e.field}</small></div>
        <div class="bb"><span style="width:${(e.cost/maxe*100).toFixed(1)}%" role="img" aria-label="${e.name} 事業費 ${plainYen(e.cost)}"></span></div>
        <div class="bv">${yen(e.cost)}</div>
      </div>`;
    }).join('');
    el.innerHTML=`
      <h2 class="sec">実施計画 — 分野別の概算事業費（令和7〜9年度／3年計・降順）</h2>
      <p class="lead">基本計画の施策を実現する具体的方策。3年計画で毎年度ローリング更新されます。総額 約 <b>${yen(total)}</b>（概算事業費の合計）。事業費の大きい順に並べています。</p>
      <div class="card2" style="margin-bottom:24px">${rows}</div>
      <h2 class="sec">主要事業 上位12（事業費・3年計／降順）</h2>
      <p class="lead">医療・介護・福祉の特別会計繰出や広域組合負担金が上位を占めます。</p>
      <div class="card2">${evrows}</div>`;
    animateBars(el);
  }

  /* ---------- 住民の声タブ ---------- */
  function donut(items, colors){
    const tot=items.reduce((a,i)=>a+i.value,0); let acc=0; const segs=[];
    items.forEach((it,i)=>{const frac=it.value/tot; const a0=acc*360; acc+=frac; const a1=acc*360;
      segs.push(`${colors[i%colors.length]} ${a0}deg ${a1}deg`);});
    return `<div class="donut-wrap">
      <div style="width:128px;height:128px;border-radius:50%;background:conic-gradient(${segs.join(',')});flex:0 0 auto"></div>
      <div class="legend">${items.map((it,i)=>`<div><span class="ld" style="background:${colors[i%colors.length]}"></span>${it.label} <b style="margin-left:4px">${it.value}%</b></div>`).join('')}</div>
    </div>`;
  }
  function hbars(items, opts={}){
    const max=opts.max || Math.max(...items.map(i=>i.value));
    const unit=opts.unit||'%';
    return items.map(it=>`<div class="sbar ${it.weak?'weak':''}">
      <div class="sl"><span>${it.label}</span><span class="pct">${fmt(it.value)}${unit}</span></div>
      <div class="st"><span style="width:${(it.value/max*100).toFixed(1)}%"></span></div>
    </div>`).join('');
  }
  function renderSurvey(){
    const el=document.getElementById('p-survey');
    // 順序のある選択肢は単一色相の濃淡（Blueランプ）＋無回答は灰。色のみに依存せず数値も併記。
    const C5=['#0017C1','#3460FB','#7096F8','#C5D7FB','#CCCCCC'];
    const C4=['#0017C1','#3460FB','#7096F8','#CCCCCC'];
    el.innerHTML=`
      <h2 class="sec">住民の声 — 住民意識調査（令和6年実施）</h2>
      <p class="lead">対象：${SURVEY.meta.survey.target}／調査期間 ${SURVEY.meta.survey.period}／有効回答 ${fmt(SURVEY.meta.survey.responses)}件（回収率 ${SURVEY.meta.survey.response_rate}%）。</p>
      <div class="meta-note">
        <b>データの定義：</b>割合（%）は有効回答（n=${fmt(SURVEY.meta.survey.responses)}）に対する比率。「複数回答・件数」と記したグラフは回答した人数（件）で、合計は100%になりません。出典：第6次日野町総合計画にかかる住民意識調査結果（概要）。
      </div>

      <div class="two">
        <div class="card2"><h3>日野町の良いところ</h3><div class="csrc">そう思う＋ややそう思う（%）／n=${fmt(SURVEY.meta.survey.responses)}</div>${hbars(SURVEY.town_strengths.items)}</div>
        <div class="card2"><h3>町政の満足度</h3><div class="csrc">満足＋やや満足（%）／n=${fmt(SURVEY.meta.survey.responses)}</div>${hbars(SURVEY.satisfaction.items)}</div>
      </div>

      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>協働のまちづくりへの関心</h3><div class="csrc">構成比（%）</div>${donut(SURVEY.collaboration.interest,C5)}</div>
        <div class="card2"><h3>協働ができていると思うか</h3><div class="csrc">構成比（%）</div>${donut(SURVEY.collaboration.achieved,C5)}</div>
      </div>

      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>町政情報の入手方法</h3><div class="csrc">複数回答・件数</div>${hbars(SURVEY.info_source.items,{unit:'件'})}</div>
        <div class="card2"><h3>「幸せ」でいるために大切なこと</h3><div class="csrc">複数回答・件数</div>${hbars(SURVEY.happiness_factors.items,{unit:'件'})}</div>
      </div>

      <h2 class="sec" style="margin-top:30px">回答者の属性</h2>
      <div class="two">
        <div class="card2"><h3>年齢</h3><div class="csrc">構成比（%）</div>${hbars(SURVEY.respondents.age)}</div>
        <div class="card2"><h3>居住地区</h3><div class="csrc">構成比（%）</div>${hbars(SURVEY.respondents.district)}</div>
      </div>
      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>世帯構成</h3><div class="csrc">構成比（%）</div>${donut(SURVEY.respondents.household,C5)}</div>
        <div class="card2"><h3>居住歴</h3><div class="csrc">構成比（%）</div>${donut(SURVEY.respondents.residency,C4)}</div>
      </div>`;
  }

  function animateBars(scope){
    // バーは初期width設定済み。reduce-motion時はそのまま。
  }

  /* ---------- タブ制御 ---------- */
  const tabs=[...document.querySelectorAll('.tab')];
  const panels=[...document.querySelectorAll('.panel')];
  function activate(name){
    tabs.forEach(t=>t.setAttribute('aria-selected', t.dataset.tab===name));
    panels.forEach(p=>p.dataset.active = (p.dataset.tab===name));
    if(name==='kpi') renderKpi();
    if(name==='plan') renderPlan();
    if(name==='survey') renderSurvey();
    if(name==='overview') renderOverview();
    if(location.hash.slice(1)!==name) history.replaceState(null,'',`#${name}`);
    window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});
  }
  tabs.forEach(t=>t.addEventListener('click',()=>activate(t.dataset.tab)));
  // 初期描画
  renderOverview();
  const init = location.hash.slice(1);
  if(['overview','kpi','plan','survey'].includes(init)) activate(init);
})();
