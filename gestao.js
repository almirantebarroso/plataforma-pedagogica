
// Gerenciamento de cadastros

const renderCadAnterior = renderCad;

renderCad = function() {
  renderCadAnterior();

  const professores = sorted(db.teachers);
  const alunos = studentsFor(panel.cad);

  $('controls').insertAdjacentHTML('beforeend', `
    <section class="card">
      <h2>Gerenciar cadastros</h2>

      <p class="muted">
        Utilize esta área para corrigir cadastros
        ou remover pessoas da plataforma.
      </p>

      <div class="grid">

        <section class="card">
          <h3>Excluir professor</h3>

          <select id="excluir-professor">
            ${options([
              ['', 'Selecione o professor'],
              ...professores.map(t => [
                t.id,
                t.name + ' · ' + t.subject
              ])
            ], '')}
          </select>

          <div class="actions">
            <button id="btn-excluir-professor"
              style="background:#b52e35;color:white">
              Excluir professor
            </button>
          </div>

          <small>
            As avaliações anteriores serão preservadas.
          </small>
        </section>

        <section class="card">
          <h3>Excluir estudante</h3>

          <p class="muted">
            Selecione primeiro a turma
            na área de cadastros acima.
          </p>

          <select id="excluir-aluno">
            ${options([
              ['', 'Selecione o estudante'],
              ...alunos.map(a => [a.id, a.name])
            ], '')}
          </select>

          <div class="actions">
            <button id="btn-excluir-aluno"
              style="background:#b52e35;color:white">
              Excluir estudante
            </button>
          </div>

          <small>
            O cadastro e todos os registros
            do estudante serão apagados.
          </small>
        </section>

      </div>
    </section>
  `);

  $('btn-excluir-professor').onclick =
    excluirProfessor;

  $('btn-excluir-aluno').onclick =
    excluirAluno;
};

async function excluirProfessor() {
  if (busy) return;

  const codigo = $('excluir-professor').value;

  const professor = db.teachers.find(
    t => t.id === codigo
  );

  if (!professor) {
    return msg('Selecione um professor.', true);
  }

  if (!confirm(
    'Deseja excluir o cadastro de ' +
    professor.name +
    '? As avaliações anteriores serão mantidas.'
  )) return;

  const next = structuredClone(db);

  next.teachers = next.teachers.filter(
    t => t.id !== codigo
  );

  if (await commit(next)) {

    if (panel.prof.teacher === codigo) {
      panel.prof.teacher = '';
    }

    render();

    msg('✓ Professor excluído com sucesso.');
  }
}

async function excluirAluno() {
  if (busy) return;

  const codigo = $('excluir-aluno').value;

  const aluno = db.students.find(
    a => a.id === codigo
  );

  if (!aluno) {
    return msg('Selecione um estudante.', true);
  }

  if (!confirm(
    'ATENÇÃO!\n\nExcluir definitivamente ' +
    aluno.name +
    ' e todos os seus registros?\n\n' +
    'Esta ação não poderá ser desfeita pelo site.'
  )) return;

  const next = structuredClone(db);

  // Remove o cadastro
  next.students = next.students.filter(
    a => a.id !== codigo
  );

  // Remove notas e habilidades
  Object.keys(next.assessments).forEach(k => {
    if (k.startsWith(codigo + '/')) {
      delete next.assessments[k];
    }
  });

  // Remove fichas do conselho
  Object.keys(next.council).forEach(k => {
    if (k.startsWith(codigo + '/')) {
      delete next.council[k];
    }
  });

  // Remove registros de conduta
  next.conduct = next.conduct.filter(
    r => r.studentId !== codigo
  );

  if (await commit(next)) {

    Object.values(panel).forEach(s => {
      if (s.student === codigo) {
        s.student = '';
      }
    });

    render();

    msg('✓ Estudante excluído com sucesso.');
  }
}
