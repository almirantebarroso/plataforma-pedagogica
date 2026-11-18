
// Painel de prioridades do Conselho de Classe
(function(){

  const renderAnterior = render;

  render = function(){
    renderAnterior();

    if(page !== 'dir' || !client) return;

    const seletor = $('controls').querySelector('section.grid');

    if(!seletor) return;

    const estado = panel.dir;
    const ano = String(estado.year);
    const turno = estado.shiftView || 'Tarde';

    const turmas = sorted(db.classes.filter(t =>
      String(t.year) === ano &&
      t.shift === turno
    ));

    const grupos = [];

    let totalFinal = 0;
    let totalOutros = 0;
    let turmasComFinal = 0;

    function notaValida(v){
      return typeof v === 'number' &&
        Number.isFinite(v) &&
        v >= 0 && v <= 10;
    }

    function formatarNota(v){
      return v.toLocaleString('pt-BR',{
        minimumFractionDigits:1,
        maximumFractionDigits:2
      });
    }

    for(const turma of turmas){

      const alunos = sorted(db.students.filter(a =>
        a.classId === turma.id
      ));

      const finais = [];
      const outros = [];

      for(const aluno of alunos){

        const registro = key({
          student:aluno.id,
          year:ano
        });

        const avaliacoes =
          db.assessments[registro] || {};

        const ficha =
          db.council[registro] || {};

        const materiasFinal = [];

        let temApontamento =
          Object.values(ficha).some(v =>
            v !== '' && v != null && v !== false
          );

        for(const [materia, dados]
          of Object.entries(avaliacoes)){

          const notas = dados.grades || {};
          const habilidades = dados.marks || {};

          if(
            Object.values(notas).some(notaValida) ||
            Object.values(habilidades).some(v =>
              Object.hasOwn(levels,v)
            )
          ){
            temApontamento = true;
          }

          if(notaValida(notas.final) && notas.final < 7){

            materiasFinal.push({
              materia,
              nota:notas.final
            });

          }
        }

        if(materiasFinal.length){

          finais.push({
            aluno,
            materias:materiasFinal
          });

        }else if(temApontamento){

          outros.push({aluno});

        }
      }

      finais.sort((a,b) =>
        b.materias.length - a.materias.length ||
        a.aluno.name.localeCompare(
          b.aluno.name,'pt-BR'
        )
      );

      totalFinal += finais.length;
      totalOutros += outros.length;

      if(finais.length) turmasComFinal++;

      grupos.push({
        turma,
        finais,
        outros
      });
    }

    function botaoAluno(aluno,turma){

      return `
        <button
          type="button"
          data-prioridade-aluno="${esc(aluno.id)}"
          data-prioridade-turma="${esc(turma.id)}"
          style="
            background:#245cba;
            color:white;
            font-size:.85rem;
          "
        >
          Abrir ficha
        </button>
      `;

    }

    const lista = grupos.map(g => `

      <details class="card" ${g.finais.length?'open':''}>

        <summary>
          ${esc(g.turma.name)}
          —
          <span style="color:${
            g.finais.length?'#b52e35':'#596c80'
          }">
            ${g.finais.length} aluno(s) na final
          </span>
        </summary>

        ${g.finais.length

          ? g.finais.map(item => `

            <div class="item">

              <div class="row">
                <strong>
                  ${esc(item.aluno.name)}
                </strong>

                ${botaoAluno(item.aluno,g.turma)}
              </div>

              <p style="color:#b52e35">

                ${item.materias.map(m =>
                  esc(m.materia) +
                  ' (' + formatarNota(m.nota) + ')'
                ).join(' · ')}

              </p>

              <small>
                ${item.materias.length}
                disciplina(s) na final
              </small>

            </div>

          `).join('')

          : `<p class="muted">
               Nenhum aluno identificado na final.
             </p>`

        }

      </details>

    `).join('');

    const outrosHTML = grupos
      .filter(g => g.outros.length)
      .map(g => `

        <h3>${esc(g.turma.name)}</h3>

        ${g.outros.map(item => `

          <div class="item row">

            <strong>
              ${esc(item.aluno.name)}
            </strong>

            ${botaoAluno(item.aluno,g.turma)}

          </div>

        `).join('')}

      `).join('');

    seletor.insertAdjacentHTML('beforebegin',`

      <section id="painel-prioridades" class="card">

        <div class="row">

          <h2>Prioridades do Conselho de Classe</h2>

          <button
            type="button"
            id="atualizar-prioridades"
          >
            Atualizar lista
          </button>

        </div>

        <p class="muted">
          Ano letivo ${esc(ano)} · Turno ${esc(turno)}
        </p>

        <div class="grid">

          <div style="
            background:#fff0f0;
            padding:16px;
            border-radius:10px
          ">
            <small>Alunos na final</small>
            <div style="
              font-size:2rem;
              font-weight:700;
              color:#b52e35
            ">
              ${totalFinal}
            </div>
          </div>

          <div style="
            background:#eaf1fb;
            padding:16px;
            border-radius:10px
          ">
            <small>Turmas com alunos na final</small>
            <div style="
              font-size:2rem;
              font-weight:700
            ">
              ${turmasComFinal}
            </div>
          </div>

          <div style="
            background:#f3f6fa;
            padding:16px;
            border-radius:10px
          ">
            <small>Outros alunos com apontamentos</small>
            <div style="
              font-size:2rem;
              font-weight:700
            ">
              ${totalOutros}
            </div>
          </div>

        </div>

        <br>

        <h3>Alunos na final por turma</h3>

        <p class="muted">
          São exibidos os estudantes com média final
          inferior a 7 em pelo menos uma disciplina.
        </p>

        ${lista || '<p>Nenhuma turma disponível.</p>'}

        <details class="card">

          <summary>
            Outros alunos com apontamentos
            (${totalOutros})
          </summary>

          <p class="muted">
            Estudantes com registros pedagógicos,
            mas sem média inferior a 7 identificada.
            Podem existir notas pendentes.
          </p>

          ${outrosHTML || '<p>Nenhum registro.</p>'}

        </details>

        <small>
          A ausência de notas não significa aprovação.
          Os registros fictícios de conduta não são
          considerados neste painel.
        </small>

      </section>

      <h3>Consultar qualquer estudante</h3>

    `);

    $('painel-prioridades').addEventListener(
      'click',
      async function(e){

        const botao = e.target.closest(
          '[data-prioridade-aluno]'
        );

        if(botao){

          if(busy || !canLeave()) return;

          panel.dir.classId =
            botao.dataset.prioridadeTurma;

          panel.dir.student =
            botao.dataset.prioridadeAluno;

          msg('');
          render();

          $('editor').scrollIntoView({
            behavior:'smooth',
            block:'start'
          });

          return;
        }

        if(e.target.id === 'atualizar-prioridades'){

          if(busy) return;

          if(dirty()){
            return msg(
              'Salve as alterações antes de atualizar.',
              true
            );
          }

          e.target.disabled = true;

          try{

            await load();

            msg('✓ Lista de prioridades atualizada.');

          }catch(erro){

            msg(
              'Não foi possível atualizar: ' +
              erro.message,
              true
            );

          }finally{

            e.target.disabled = false;

          }
        }
      }
    );

  };

})();
