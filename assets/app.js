/* ===== 第6次日野町総合計画 進捗ダッシュボード ===== */
(function(){
  const PC = {}; KPI.pillars.forEach(p=>PC[p.id]=p);
  const fmt = n => n==null ? '—' : n.toLocaleString('ja-JP');
  const yen = t => { // 千円→読みやすく
    if(t>=1000000) return (t/1000000).toFixed(2)+'<small>十億円</small>';
    if(t>=10000)   return (t/10000).toFixed(t>=100000?0:1)+'<small>千万円</small>';
    return fmt(t)+'<small>千円</small>';
  };
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
  function dirClass(d){return d==='up'?'dir-up':d==='down'?'dir-down':'dir-neutral';}
  function dirColor(d){return d==='up'?'var(--good)':d==='down'?'var(--warn)':'var(--neutral)';}

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
      <p class="lead">第6次総合計画は令和3〜12年度の10年計画。今年度は中間目標（R7）の評価年にあたります。3つの情報源を34分野で横断します。</p>
      <div class="stats">
        <div class="stat"><div class="k">計画期間</div><div class="v">5<small>/10年目</small></div><div class="note">R3〜R12（中間年）</div></div>
        <div class="stat"><div class="k">成果指標(KPI)</div><div class="v">${kpiCount}<small>指標</small></div><div class="note">${kpiFields}/34分野で設定</div></div>
        <div class="stat"><div class="k">実施計画 R7-R9 総額</div><div class="v">${yen(budget)}</div><div class="note">約180事業</div></div>
        <div class="stat"><div class="k">住民意識調査</div><div class="v">${SURVEY.meta.survey.response_rate}<small>%</small></div><div class="note">回収率 / ${fmt(SURVEY.meta.survey.responses)}件</div></div>
        <div class="stat"><div class="k">幸福度（平均）</div><div class="v">${SURVEY.happiness.average}<small>/10点</small></div><div class="note">6点以上が6割超</div></div>
      </div>

      <h2 class="sec">5つの政策の柱と予算配分（R7-R9）</h2>
      <div class="pillars">
        ${KPI.pillars.map(p=>`<span class="pill"><span class="dot" style="background:${p.color}"></span>${p.id}. ${p.name}</span>`).join('')}
      </div>
      <div class="card2">
        ${KPI.pillars.map(p=>`
          <div class="budrow">
            <div class="bn">${p.id}. ${p.name}</div>
            <div class="bb"><span style="width:${(pt[p.id]/maxPt*100).toFixed(1)}%;background:${p.color}"></span></div>
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
      <button class="chip" data-pf="0" aria-pressed="${kpiFilter===0}" style="${kpiFilter===0?'background:#3b6e8c':''}">すべて</button>
      ${KPI.pillars.map(p=>`<button class="chip" data-pf="${p.id}" aria-pressed="${kpiFilter===p.id}" style="${kpiFilter===p.id?'background:'+p.color:''}">${p.id}. ${p.name}</button>`).join('')}
    </div>`;
    const cards = fields.map(f=>{
      const c=PC[f.pillar].color;
      let inner;
      if(!f.indicators.length){
        inner=`<div class="no-kpi">この分野は数値目標（成果指標）が設定されていません。<br><span>主な取組のみ</span></div>`;
      } else {
        inner=f.indicators.map(ind=>{
          const tp=targetProgress(ind);
          const col=dirColor(ind.direction);
          const w = tp? tp.midPct : 0;
          return `<div class="ind">
            <div class="iname">${ind.name}<span class="dirtag ${dirClass(ind.direction)}">${dirLabel(ind.direction)}</span></div>
            <div class="bar"><span style="width:${w.toFixed(0)}%;background:${col}"></span></div>
            <div class="barmeta">
              <span>基準 <b>${fmt(ind.baseline)}${ind.unit}</b> <small>(${ind.baseline_year})</small></span>
              <span>中間 <b style="color:${col}">${fmt(ind.target_mid)}${ind.unit}</b> → 最終 <b>${fmt(ind.target_final)}${ind.unit}</b></span>
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
      <h2 class="sec">KPI・進捗 — 分野別の成果指標</h2>
      <p class="lead">各指標の <b>基準値</b> から <b>最終目標(R12)</b> までを100%としたとき、<b>中間目標(R7)</b> がどこに位置するかをバーで表示しています。色は改善の向き（緑＝増加で改善 / 赤＝減少で改善 / 灰＝維持・中立）。現状の実績値が公表されれば、ここに「現在地」を重ねられます。</p>
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
      const pid=KPI.fields.find(k=>k.id===f.id).pillar; const c=PC[pid].color;
      return `<div class="budrow">
        <div class="bn">${f.id}. ${f.name}<small>${PC[pid].name}</small></div>
        <div class="bb"><span style="width:${(f.total/max*100).toFixed(1)}%;background:${c}"></span></div>
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
      const pid=KPI.fields.find(k=>k.id===e.id).pillar; const c=PC[pid].color;
      return `<div class="budrow">
        <div class="bn">${e.name}<small>分野${e.id} ${e.field}</small></div>
        <div class="bb"><span style="width:${(e.cost/maxe*100).toFixed(1)}%;background:${c}"></span></div>
        <div class="bv">${yen(e.cost)}</div>
      </div>`;
    }).join('');
    el.innerHTML=`
      <h2 class="sec">実施計画 — 分野別の概算事業費（令和7〜9年度／3年計）</h2>
      <p class="lead">基本計画の施策を実現する具体的方策。3年計画で毎年度ローリング更新されます。総額 約 <b>${yen(total)}</b>。バー色は政策の柱。</p>
      <div class="card2" style="margin-bottom:24px">${rows}</div>
      <h2 class="sec">主要事業 上位12（事業費）</h2>
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
    const C5=['#3b6e8c','#5BA84F','#E8923A','#d9534f','#cfd6db'];
    const C4=['#3b6e8c','#7fae6b','#E8923A','#cfd6db'];
    el.innerHTML=`
      <h2 class="sec">住民の声 — 住民意識調査（令和6年実施）</h2>
      <p class="lead">対象：${SURVEY.meta.survey.target}／調査期間 ${SURVEY.meta.survey.period}／有効回答 ${fmt(SURVEY.meta.survey.responses)}件（回収率 ${SURVEY.meta.survey.response_rate}%）。</p>

      <div class="two">
        <div class="card2"><h3>日野町の良いところ（そう思う＋ややそう思う）</h3>${hbars(SURVEY.town_strengths.items)}</div>
        <div class="card2"><h3>町政の満足度（満足＋やや満足）</h3>${hbars(SURVEY.satisfaction.items)}</div>
      </div>

      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>協働のまちづくりへの関心</h3>${donut(SURVEY.collaboration.interest,C5)}</div>
        <div class="card2"><h3>協働ができていると思うか</h3>${donut(SURVEY.collaboration.achieved,C5)}</div>
      </div>

      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>町政情報の入手方法（複数回答・件数）</h3>${hbars(SURVEY.info_source.items,{unit:'件'})}</div>
        <div class="card2"><h3>「幸せ」でいるために大切なこと（複数回答・件数）</h3>${hbars(SURVEY.happiness_factors.items,{unit:'件'})}</div>
      </div>

      <h2 class="sec" style="margin-top:30px">回答者の属性</h2>
      <div class="two">
        <div class="card2"><h3>年齢</h3>${hbars(SURVEY.respondents.age)}</div>
        <div class="card2"><h3>居住地区</h3>${hbars(SURVEY.respondents.district)}</div>
      </div>
      <div class="two" style="margin-top:24px">
        <div class="card2"><h3>世帯構成</h3>${donut(SURVEY.respondents.household,C5)}</div>
        <div class="card2"><h3>居住歴</h3>${donut(SURVEY.respondents.residency,C4)}</div>
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
