import type {
  Request,
  Response,
} from 'express'

import { pool } from '../database'

export async function buscarTarefaPorId(
  req: Request,
  res: Response
) {
  try {
    const tarefaId = Number(req.params.id)

    if (!tarefaId) {
      return res.status(400).json({
        mensagem: 'ID da tarefa inválido.',
      })
    }

    const tarefaResultado = await pool.query(
      `
      SELECT
        tarefas.id,
        tarefas.titulo,
        tarefas.descricao,
        tarefas.solicitante,
        setores.nome AS setor,
        tarefas.categoria,
        tarefas.prioridade,
        usuarios.nome AS responsavel,
        tarefas.prazo,
        tarefas.tempo_previsto,
        tarefas.status,
        tarefas.criado_em,
        tarefas.atualizado_em,
        tarefas.concluido_em
      FROM tarefas
      LEFT JOIN setores
        ON setores.id = tarefas.setor_id
      LEFT JOIN usuarios
        ON usuarios.id = tarefas.responsavel_id
      WHERE tarefas.id = $1
      LIMIT 1
      `,
      [tarefaId]
    )

    if (tarefaResultado.rows.length === 0) {
      return res.status(404).json({
        mensagem: 'Tarefa não encontrada.',
      })
    }

    const comentariosResultado = await pool.query(
      `
      SELECT
        comentarios.id,
        comentarios.texto,
        comentarios.criado_em,
        usuarios.nome AS autor
      FROM comentarios
      LEFT JOIN usuarios
        ON usuarios.id = comentarios.autor_id
      WHERE comentarios.tarefa_id = $1
      ORDER BY comentarios.criado_em ASC
      `,
      [tarefaId]
    )

    const registrosTempoResultado = await pool.query(
      `
      SELECT
        registros_tempo.id,
        registros_tempo.data,
        registros_tempo.inicio,
        registros_tempo.fim,
        registros_tempo.duracao_minutos,
        registros_tempo.acao,
        registros_tempo.origem,
        registros_tempo.justificativa,
        registros_tempo.criado_em,
        usuarios.nome AS usuario
      FROM registros_tempo
      LEFT JOIN usuarios
        ON usuarios.id = registros_tempo.usuario_id
      WHERE registros_tempo.tarefa_id = $1
      ORDER BY registros_tempo.criado_em DESC
      `,
      [tarefaId]
    )

    const historicoResultado = await pool.query(
      `
      SELECT
        historico_status.id,
        historico_status.status_anterior,
        historico_status.status_novo,
        historico_status.criado_em,
        usuarios.nome AS usuario
      FROM historico_status
      LEFT JOIN usuarios
        ON usuarios.id = historico_status.usuario_id
      WHERE historico_status.tarefa_id = $1
      ORDER BY historico_status.criado_em DESC
      `,
      [tarefaId]
    )

    return res.json({
      tarefa: tarefaResultado.rows[0],
      comentarios: comentariosResultado.rows,
      registrosTempo: registrosTempoResultado.rows,
      historicoStatus: historicoResultado.rows,
    })
  } catch (erro) {
    console.error(
      'Erro ao buscar detalhes da tarefa:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao buscar detalhes da tarefa.',
    })
  }
}

export async function listarTarefas(
  _req: Request,
  res: Response
) {
  try {
    const resultado = await pool.query(`
      SELECT
        tarefas.id,
        tarefas.titulo,
        tarefas.descricao,
        tarefas.solicitante,
        setores.nome AS setor,
        tarefas.categoria,
        tarefas.prioridade,
        usuarios.nome AS responsavel,
        tarefas.prazo,
        tarefas.tempo_previsto,
        tarefas.status,
        tarefas.criado_em,
        tarefas.atualizado_em,
        tarefas.concluido_em
      FROM tarefas
      LEFT JOIN setores
        ON setores.id = tarefas.setor_id
      LEFT JOIN usuarios
        ON usuarios.id = tarefas.responsavel_id
      ORDER BY tarefas.criado_em DESC
    `)

    return res.json(resultado.rows)
  } catch (erro) {
    console.error(
      'Erro ao buscar tarefas:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao buscar tarefas',
    })
  }
}

export async function adicionarComentario(
  req: Request,
  res: Response
) {
  try {
    const tarefaId = Number(req.params.id)

    const {
      texto,
      usuarioId,
    } = req.body ?? {}

    if (!tarefaId) {
      return res.status(400).json({
        mensagem:
          'ID da tarefa inválido.',
      })
    }

    if (!texto) {
      return res.status(400).json({
        mensagem:
          'Informe o comentário.',
      })
    }

    if (!usuarioId) {
      return res.status(400).json({
        mensagem:
          'Informe o usuário.',
      })
    }

    const tarefaResultado =
      await pool.query(
        `
        SELECT id
        FROM tarefas
        WHERE id = $1
        LIMIT 1
        `,
        [tarefaId]
      )

    if (
      tarefaResultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Tarefa não encontrada.',
      })
    }

    const usuarioResultado =
      await pool.query(
        `
        SELECT id, nome
        FROM usuarios
        WHERE id = $1
          AND ativo = TRUE
        LIMIT 1
        `,
        [usuarioId]
      )

    if (
      usuarioResultado.rows.length === 0
    ) {
      return res.status(400).json({
        mensagem:
          'Usuário inválido.',
      })
    }

    const resultado =
      await pool.query(
        `
        INSERT INTO comentarios (
          tarefa_id,
          autor_id,
          texto
        )
        VALUES (
          $1,
          $2,
          $3
        )
        RETURNING
          id,
          tarefa_id,
          autor_id,
          texto,
          criado_em
        `,
        [
          tarefaId,
          usuarioId,
          texto,
        ]
      )

    const comentario =
      resultado.rows[0]

    return res.status(201).json({
      mensagem:
        'Comentário adicionado com sucesso.',
      comentario: {
        id: comentario.id,
        tarefaId:
          comentario.tarefa_id,
        autorId:
          comentario.autor_id,
        autor:
          usuarioResultado.rows[0]
            .nome,
        texto:
          comentario.texto,
        criadoEm:
          comentario.criado_em,
      },
    })
  } catch (erro) {
    console.error(
      'Erro ao adicionar comentário:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao adicionar comentário.',
    })
  }
}

export async function adicionarRegistroTempo(
  req: Request,
  res: Response
) {
  try {
    const tarefaId = Number(req.params.id)

    const {
      usuarioId,
      data,
      inicio,
      fim,
      duracaoMinutos,
      acao,
      origem,
      justificativa,
    } = req.body ?? {}

    if (!tarefaId) {
      return res.status(400).json({
        mensagem:
          'ID da tarefa inválido.',
      })
    }

    if (!usuarioId) {
      return res.status(400).json({
        mensagem:
          'Informe o usuário.',
      })
    }

    if (!acao) {
      return res.status(400).json({
        mensagem:
          'Informe a ação realizada.',
      })
    }

    if (
      origem !== 'Cronômetro' &&
      origem !== 'Manual'
    ) {
      return res.status(400).json({
        mensagem:
          'Origem inválida.',
      })
    }

    if (
      duracaoMinutos === undefined ||
      Number(duracaoMinutos) < 0
    ) {
      return res.status(400).json({
        mensagem:
          'Informe uma duração válida.',
      })
    }

    const tarefaResultado =
      await pool.query(
        `
        SELECT id
        FROM tarefas
        WHERE id = $1
        LIMIT 1
        `,
        [tarefaId]
      )

    if (
      tarefaResultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Tarefa não encontrada.',
      })
    }

    const usuarioResultado =
      await pool.query(
        `
        SELECT id, nome
        FROM usuarios
        WHERE id = $1
          AND ativo = TRUE
        LIMIT 1
        `,
        [usuarioId]
      )

    if (
      usuarioResultado.rows.length === 0
    ) {
      return res.status(400).json({
        mensagem:
          'Usuário inválido.',
      })
    }

    const resultado =
      await pool.query(
        `
        INSERT INTO registros_tempo (
          tarefa_id,
          usuario_id,
          data,
          inicio,
          fim,
          duracao_minutos,
          acao,
          origem,
          justificativa
        )
        VALUES (
          $1,
          $2,
          COALESCE($3, CURRENT_DATE),
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING *
        `,
        [
          tarefaId,
          usuarioId,
          data || null,
          inicio || null,
          fim || null,
          Number(duracaoMinutos),
          acao,
          origem,
          justificativa || null,
        ]
      )

    return res.status(201).json({
      mensagem:
        'Registro de tempo adicionado com sucesso.',
      registroTempo:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao adicionar registro de tempo:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao adicionar registro de tempo.',
    })
  }
}

export async function adicionarRegistroTempoManual(
  req: Request,
  res: Response
) {
  try {
    const {
      usuarioId,
      data,
      inicio,
      fim,
      duracaoMinutos,
      acao,
      justificativa,
    } = req.body ?? {}

    if (
      !usuarioId ||
      !acao ||
      duracaoMinutos === undefined
    ) {
      return res.status(400).json({
        mensagem:
          'Usuário, ação e duração são obrigatórios.',
      })
    }

    const usuario =
      await pool.query(
        `
        SELECT id
        FROM usuarios
        WHERE id = $1
        AND ativo = true
        `,
        [usuarioId]
      )

    if (
      usuario.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Usuário não encontrado.',
      })
    }

    const resultado =
      await pool.query(
        `
        INSERT INTO registros_tempo (
          tarefa_id,
          usuario_id,
          data,
          inicio,
          fim,
          duracao_minutos,
          acao,
          origem,
          justificativa
        )
        VALUES (
          NULL,
          $1,
          COALESCE($2, CURRENT_DATE),
          $3,
          $4,
          $5,
          $6,
          'Manual',
          $7
        )
        RETURNING *
        `,
        [
          usuarioId,
          data || null,
          inicio || null,
          fim || null,
          duracaoMinutos,
          acao,
          justificativa || null,
        ]
      )

    return res.status(201).json({
      registro:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao adicionar registro manual:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao registrar atividade manual.',
    })
  }
}

export async function listarRegistrosTempoHoje(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      Number(req.params.usuarioId)

    if (!usuarioId) {
      return res.status(400).json({
        mensagem:
          'Usuário inválido.',
      })
    }

    const resultado =
      await pool.query(
        `
        SELECT
          rt.id,
          rt.tarefa_id,
          rt.usuario_id,
          rt.data,
          rt.inicio,
          rt.fim,
          rt.duracao_minutos,
          rt.acao,
          rt.origem,
          rt.justificativa,
          t.titulo AS tarefa_titulo
        FROM registros_tempo rt
        LEFT JOIN tarefas t
          ON t.id = rt.tarefa_id
        WHERE rt.usuario_id = $1
          AND rt.data = CURRENT_DATE
        ORDER BY rt.criado_em DESC
        `,
        [usuarioId]
      )

    return res.json({
      registros:
        resultado.rows,
    })
  } catch (erro) {
    console.error(
      'Erro ao buscar registros de tempo:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao buscar registros de tempo.',
    })
  }
}

export async function criarTarefa(
  req: Request,
  res: Response
) {
  try {
    const {
      titulo,
      descricao,
      solicitante,
      setor,
      categoria,
      prioridade,
      responsavel,
      prazo,
      tempoPrevisto,
    } = req.body

    if (
      !titulo ||
      !descricao ||
      !solicitante ||
      !setor ||
      !categoria ||
      !prioridade
    ) {
      return res.status(400).json({
        mensagem:
          'Preencha os campos obrigatórios.',
      })
    }

    const setorResultado =
      await pool.query(
        `
        SELECT id
        FROM setores
        WHERE nome = $1
          AND ativo = TRUE
        LIMIT 1
        `,
        [setor]
      )

    if (
      setorResultado.rows.length === 0
    ) {
      return res.status(400).json({
        mensagem:
          'Setor informado não existe.',
      })
    }

    const setorId =
      setorResultado.rows[0].id

    let responsavelId = null

    if (responsavel) {
      const usuarioResultado =
        await pool.query(
          `
          SELECT id
          FROM usuarios
          WHERE nome = $1
            AND ativo = TRUE
          LIMIT 1
          `,
          [responsavel]
        )

      if (
        usuarioResultado.rows.length > 0
      ) {
        responsavelId =
          usuarioResultado.rows[0].id
      }
    }

    const resultado =
      await pool.query(
        `
        INSERT INTO tarefas (
          titulo,
          descricao,
          solicitante,
          setor_id,
          categoria,
          prioridade,
          responsavel_id,
          prazo,
          tempo_previsto,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'Nova'
        )
        RETURNING *
        `,
        [
          titulo,
          descricao,
          solicitante,
          setorId,
          categoria,
          prioridade,
          responsavelId,
          prazo || null,
          tempoPrevisto || null,
        ]
      )

    return res.status(201).json({
      mensagem:
        'Tarefa criada com sucesso.',
      tarefa:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao criar tarefa:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao criar tarefa.',
    })
  }
}

export async function alterarStatusTarefa(
  req: Request,
  res: Response
) {
  const client = await pool.connect()

  try {
    const tarefaId =
      Number(req.params.id)

    const {
      status,
      usuarioId,
    } = req.body

    if (!tarefaId) {
      return res.status(400).json({
        mensagem:
          'ID da tarefa inválido.',
      })
    }

    if (!status) {
      return res.status(400).json({
        mensagem:
          'Informe o novo status.',
      })
    }

    const statusPermitidos = [
      'Nova',
      'Em análise',
      'Planejada',
      'Em andamento',
      'Aguardando terceiro',
      'Aguardando solicitante',
      'Bloqueada',
      'Concluída',
      'Cancelada',
    ]

    if (
      !statusPermitidos.includes(
        status
      )
    ) {
      return res.status(400).json({
        mensagem:
          'Status inválido.',
      })
    }

    await client.query('BEGIN')

    const tarefaResultado =
      await client.query(
        `
        SELECT
          id,
          status
        FROM tarefas
        WHERE id = $1
        FOR UPDATE
        `,
        [tarefaId]
      )

    if (
      tarefaResultado.rows.length === 0
    ) {
      await client.query(
        'ROLLBACK'
      )

      return res.status(404).json({
        mensagem:
          'Tarefa não encontrada.',
      })
    }

    const statusAnterior =
      tarefaResultado.rows[0].status

    const concluidoEm =
      status === 'Concluída'
        ? new Date()
        : null

    const resultado =
      await client.query(
        `
        UPDATE tarefas
        SET
          status = $1,
          atualizado_em = NOW(),
          concluido_em = $2
        WHERE id = $3
        RETURNING *
        `,
        [
          status,
          concluidoEm,
          tarefaId,
        ]
      )

    await client.query(
      `
      INSERT INTO historico_status (
        tarefa_id,
        usuario_id,
        status_anterior,
        status_novo
      )
      VALUES (
        $1,
        $2,
        $3,
        $4
      )
      `,
      [
        tarefaId,
        usuarioId || null,
        statusAnterior,
        status,
      ]
    )

    await client.query('COMMIT')

    return res.json({
      mensagem:
        'Status alterado com sucesso.',
      tarefa:
        resultado.rows[0],
    })
  } catch (erro) {
    await client.query(
      'ROLLBACK'
    )

    console.error(
      'Erro ao alterar status:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao alterar status.',
    })
  } finally {
    client.release()
  }
}