
// Atualização do conselho de classe de 2026
const ANO = '2026';
const TURMAS = ['6ºA','6ºB','7ºA','7ºB','8ºA','8ºB','9ºU'];
const TURNOS = ['Manhã','Tarde','Noite','Integral'];
const NOTAS = ['b1','b2','b3','b4','final'];
const ROTULOS = ['1º bimestre','2º bimestre','3º bimestre','4º bimestre','Média final'];
const canonTurma = v => String(v).replace(/\s+/g,'').toUpperCase();

Object.values(panel).forEach(s => {
  s.year = ANO;
  s.shiftView = 'Tarde';
});

// Cadastro automático das turmas
const loadBase = load;
load = async function(){
  for(let tentativa=0; tentativa<3; tentativa++){
    if(busy){await loadBase();return;}

    const {data:rows,error:err} =
      await client.rpc('plataforma_ler');

    if(err) throw err;

    const row = Array.isArray(rows)?rows[0]:rows;
    if(!row) throw Error('Banco não inicializado.');

    db = normalize(row.dados);
    rev = row.revisao;

    const faltam = TURMAS.filter(n =>
      !db.classes.some(c =>
        c.year===ANO &&
        c.shift==='Tarde' &&
        canonTurma(c.name)===canonTurma(n)
      )
    );

    if(!faltam.length){
      conn(`● Online · Dados compartilhados · Revisão ${rev}`);
      render();
      return;
    }

    const next = structuredClone(db);

    faltam.forEach(name => next.classes.push({
      id:uid(),
      name,
      year:ANO,
      shift:'Tarde'
    }));

    const {data,error} = await client.rpc(
      'plataforma_salvar',
      {p_revisao:rev,p_dados:next}
    );

    if(error) throw error;
    if(data){await loadBase();return;}
  }

  await loadBase();
  msg('Não foi possível inicializar as turmas. Recarregue a página.',true);
};

// Ano fixo e seleção de turno
const renderBase = render;

render = function(){
  const s = panel[page];
  s.year = ANO;

  if(s.classId && !db.classes.some(c =>
    c.id===s.classId &&
    c.year===ANO &&
    c.shift===s.shiftView
  )){
    s.classId='';
    if('student' in s) s.student='';
  }

  renderBase();
  if(!client) return;

  const area = $('controls');
  const ano = area.querySelector('select[name="year"]');

  if(ano){
    ano.value=ANO;
    ano.disabled=true;
  }

  const lab = document.createElement('label');
  lab.innerHTML = `Turno
    <select name="shiftView">
      ${options(TURNOS.map(t=>[t,t]),s.shiftView)}
    </select>`;

  const turma = area.querySelector('select[name="classId"]');

  if(turma){
    turma.closest('label').before(lab);

    for(const opt of [...turma.options]){
      if(opt.value && !db.classes.some(c =>
        c.id===opt.value && c.shift===s.shiftView
      )) opt.remove();
    }
  }else{
    const destino=area.querySelector('section.grid');
    if(destino) destino.append(lab);
  }

  const form=area.querySelector('[data-add="class"]');

  if(form){
    form.elements.year.value=ANO;
    form.elements.year.readOnly=true;
    form.elements.shift.value=s.shiftView;
  }
};

const addBase=add;

add=async function(kind,fd){
  if(kind==='class'){
    fd.set('year',ANO);
    panel.cad.shiftView=fd.get('shift')||'Tarde';
  }

  return addBase(kind,fd);
};

// Estilos e notificações
const estilo=document.createElement('style');

estilo.textContent=`
  .nota-final{font-weight:700}
  .nota-alerta{color:#a62222;font-weight:700}
  .nota-ok{color:#146044;font-weight:700}
  .aviso-salvo{
    position:fixed;
    bottom:18px;
    right:18px;
    z-index:1000;
    background:#146044;
    color:#fff;
    padding:14px 18px;
    border-radius:10px;
    box-shadow:0 3px 15px #0003;
    max-width:calc(100% - 36px)
  }
  @media print{
    .aviso-salvo{display:none!important}
  }
`;

document.head.append(estilo);

let avisoTimer;

function avisar(texto){
  $('aviso-salvo')?.remove();

  const el=document.createElement('div');

  el.id='aviso-salvo';
  el.className='aviso-salvo';
  el.setAttribute('role','status');
  el.textContent=texto;

  document.body.append(el);

  clearTimeout(avisoTimer);

  avisoTimer=setTimeout(
    ()=>el.remove(),4500
  );
}

const commitBase=commit;

commit=async function(next){
  if(busy)return false;

  const areas=[
    document.querySelector('nav'),
    $('controls'),
    $('editor')
  ];

  areas.forEach(a=>a.inert=true);

  try{
    const ok=await commitBase(next);

    if(ok){
      avisar('✓ Alterações salvas online com sucesso!');
    }

    return ok;
  }finally{
    areas.forEach(a=>a.inert=false);
  }
};

// Médias na área do professor
const assessmentBase=renderAssessment;

renderAssessment=function(s,teacher){
  assessmentBase(s,teacher);

  const grades=
    db.assessments[key(s)]?.[teacher.subject]?.grades||{};

  const form=
    $('editor').querySelector('[data-assessment]');

  form.insertAdjacentHTML('afterbegin',`
    <section class="card">
      <h3>Médias do estudante</h3>

      <p class="muted">
        Informe de 0 a 10.
        Deixe em branco se ainda não houver nota.
      </p>

      <div class="grid">
        ${NOTAS.map((n,i)=>`
          <label>
            ${ROTULOS[i]}
            <input
              type="number"
              name="nota_${n}"
              min="0"
              max="10"
              step="any"
              inputmode="decimal"
              value="${esc(grades[n]??'')}"
            >
          </label>
        `).join('')}
      </div>

      <p id="situacao-nota" aria-live="polite"></p>
    </section>
  `);

  const input=form.elements.nota_final;

  const atualizar=()=>{
    const v=input.valueAsNumber;
    const el=$('situacao-nota');
    const valida=Number.isFinite(v)&&v>=0&&v<=10;

    el.textContent=valida
      ? (v<7
        ? 'Na final — média inferior a 7'
        : 'Fora da final — média igual ou superior a 7')
      : 'Média final pendente';

    el.className=valida
      ? (v<7?'nota-alerta':'nota-ok')
      : 'muted';
  };

  input.addEventListener('input',atualizar);
  atualizar();
};

// Salvamento das notas e habilidades
const storeBase=storeForm;

storeForm=async function(form){
  if(!form.matches('[data-assessment]')){
    return storeBase(form);
  }

  const s=panel.prof;
  const teacher=db.teachers.find(t=>t.id===s.teacher);

  if(!teacher||!s.student){
    return msg('Selecione o professor e o aluno.',true);
  }

  const fd=new FormData(form);
  const grades={};

  for(const n of NOTAS){
    const raw=fd.get('nota_'+n);

    if(raw==null||raw==='') continue;

    const v=Number(raw);

    if(!Number.isFinite(v)||v<0||v>10){
      return msg('As médias devem estar entre 0 e 10.',true);
    }

    grades[n]=v;
  }

  const marks=Object.fromEntries(
    [...fd].filter(([,v])=>Object.hasOwn(levels,v))
  );

  const next=structuredClone(db);
  const k=key(s);

  next.assessments[k]={
    ...(next.assessments[k]||{}),
    [teacher.subject]:{
      marks,
      grades,
      teacher:teacher.name
    }
  };

  if(await commit(next)){
    render();
    msg('✓ Médias e habilidades salvas online.');
  }
};

// Resumo geral do aluno no Conselho de Classe
const reportBase=renderReport;

renderReport=function(s){
  reportBase(s);

  const head=$('report').querySelector('.card');

  if(!head)return;

  const items=db.assessments[key(s)]||{};

  let finais=0;
  let fora=0;
  let pendentes=0;

  const fmt=v=>
    typeof v==='number'&&Number.isFinite(v)
      ? v.toLocaleString('pt-BR',{
          minimumFractionDigits:1,
          maximumFractionDigits:20
        })
      : '—';

  const rows=Object.keys(subjects).map(sub=>{
    const g=items[sub]?.grades||{};
    const v=g.final;

    const tem=
      typeof v==='number'&&
      Number.isFinite(v)&&
      v>=0&&v<=10;

    const final=tem&&v<7;

    if(!tem)pendentes++;
    else if(final)finais++;
    else fora++;

    return `
      <tr>
        <td>${esc(sub)}</td>
        ${NOTAS.map(n=>`<td>${fmt(g[n])}</td>`).join('')}
        <td class="${!tem?'muted':final?'nota-alerta':'nota-ok'}">
          ${!tem?'Pendente':final?'Na final':'Fora da final'}
        </td>
      </tr>
    `;
  }).join('');

  head.insertAdjacentHTML('afterend',
    card('Resumo geral do estudante',`
      <div class="actions">
        <span class="chip nota-alerta">
          Na final: ${finais}
        </span>

        <span class="chip nota-ok">
          Fora da final: ${fora}
        </span>

        <span class="chip">
          Pendentes: ${pendentes}
        </span>
      </div>

      <div class="scroll">
        <table class="report-table">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>1º</th>
              <th>2º</th>
              <th>3º</th>
              <th>4º</th>
              <th>Média final</th>
              <th>Situação</th>
            </tr>
          </thead>

          <tbody>${rows}</tbody>
        </table>
      </div>

      <small>
        Critério: média final inferior a 7.
        Fora da final não equivale à decisão
        de aprovação do conselho.
      </small>
    `)
  );
};

// Exclusão dos registros de um aluno
const councilBase=renderCouncil;

renderCouncil=function(s){
  councilBase(s);

  const btn=document.createElement('button');

  btn.type='button';
  btn.className='danger';
  btn.textContent='Apagar registros deste aluno';

  $('editor').querySelector('.actions').append(btn);

  btn.onclick=async()=>{
    const st=db.students.find(i=>i.id===s.student);

    if(!st)return;

    if(dirty()){
      return msg(
        'Salve ou descarte as alterações antes de apagar.',
        true
      );
    }

    if(!confirm(
      `Apagar todas as notas, habilidades, ficha do conselho e exemplos de conduta de ${st.name} em ${ANO}? O cadastro será mantido. Esta ação não pode ser desfeita pelo site.`
    ))return;

    const next=structuredClone(db);
    const k=key(s);

    delete next.assessments[k];
    delete next.council[k];

    next.conduct=next.conduct.filter(r=>
      !(r.studentId===st.id&&String(r.year)===ANO)
    );

    if(await commit(next)){
      render();

      msg('✓ Registros do aluno apagados. Cadastro preservado.');
    }
  };
};

init();
