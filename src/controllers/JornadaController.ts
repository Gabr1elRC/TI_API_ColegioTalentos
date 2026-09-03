import type { Request, Response } from 'express'
import { pool } from '../database.js'

export async function iniciarAtividade(
  req: Request,
  res: Response
) {
  try {
    const {
      usuarioId,
      tarefaId,
      atividade,
      descricao,
    } = req.body ?? {}

    if (!usuarioId || !atividade) {
      return res.status(400).json({
        mensagem:
          'Usuário e atividade são obrigatórios.',
      })
    }

    const atividadeExistente =
      await pool.query(
        `
        SELECT id
        FROM atividades_ativas
        WHERE usuario_id = $1
        LIMIT 1
        `,
        [usuarioId]
      )

    if (
      atividadeExistente.rows.length > 0
    ) {
      return res.status(409).json({
        mensagem:
          'Este usuário já possui uma atividade em andamento.',
      })
    }

    const resultado =
      await pool.query(
        `
        INSERT INTO atividades_ativas (
          usuario_id,
          tarefa_id,
          atividade,
          descricao,
          iniciada_em,
          pausado,
          total_pausado_segundos
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          NOW(),
          false,
          0
        )
        RETURNING *
        `,
        [
          usuarioId,
          tarefaId || null,
          atividade,
          descricao || null,
        ]
      )

    return res.status(201).json({
      atividade: resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao iniciar atividade:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao iniciar atividade.',
    })
  }
}

export async function pausarAtividade(
  req: Request,
  res: Response
) {
  try {
    const { usuarioId } = req.body ?? {}

    if (!usuarioId) {
      return res.status(400).json({
        mensagem: 'Usuário é obrigatório.',
      })
    }

    const resultado = await pool.query(
      `
      UPDATE atividades_ativas
      SET
        pausado = true,
        pausa_iniciada_em = NOW(),
        atualizado_em = NOW()
      WHERE usuario_id = $1
        AND pausado = false
      RETURNING *
      `,
      [usuarioId]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensagem:
          'Nenhuma atividade ativa disponível para pausar.',
      })
    }

    return res.json({
      atividade: resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao pausar atividade:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao pausar atividade.',
    })
  }
}

export async function retomarAtividade(
  req: Request,
  res: Response
) {
  try {
    const { usuarioId } = req.body ?? {}

    if (!usuarioId) {
      return res.status(400).json({
        mensagem: 'Usuário é obrigatório.',
      })
    }

    const resultado = await pool.query(
      `
      UPDATE atividades_ativas
      SET
        total_pausado_segundos =
          total_pausado_segundos +
          EXTRACT(
            EPOCH FROM (
              NOW() - pausa_iniciada_em
            )
          )::INTEGER,

        pausado = false,
        pausa_iniciada_em = NULL,
        atualizado_em = NOW()

      WHERE usuario_id = $1
        AND pausado = true

      RETURNING *
      `,
      [usuarioId]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensagem:
          'Nenhuma atividade pausada foi encontrada.',
      })
    }

    return res.json({
      atividade: resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao retomar atividade:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao retomar atividade.',
    })
  }
}

export async function concluirAtividade(
  req: Request,
  res: Response
) {
  const client = await pool.connect()

  try {
    const { usuarioId } = req.body ?? {}

    if (!usuarioId) {
      return res.status(400).json({
        mensagem: 'Usuário é obrigatório.',
      })
    }

    await client.query('BEGIN')

    const resultadoAtividade =
      await client.query(
        `
        SELECT *
        FROM atividades_ativas
        WHERE usuario_id = $1
        FOR UPDATE
        `,
        [usuarioId]
      )

    if (
      resultadoAtividade.rows.length ===
      0
    ) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        mensagem:
          'Nenhuma atividade ativa foi encontrada.',
      })
    }

    const atividade =
      resultadoAtividade.rows[0]

    let totalPausadoSegundos =
      Number(
        atividade.total_pausado_segundos
      )

    if (
      atividade.pausado &&
      atividade.pausa_iniciada_em
    ) {
      const pausaAtual =
        await client.query(
          `
          SELECT EXTRACT(
            EPOCH FROM (
              NOW() - $1::timestamptz
            )
          )::INTEGER AS segundos
          `,
          [
            atividade
              .pausa_iniciada_em,
          ]
        )

      totalPausadoSegundos +=
        Number(
          pausaAtual.rows[0].segundos
        )
    }

    const calculoTempo =
      await client.query(
        `
        SELECT GREATEST(
          0,
          EXTRACT(
            EPOCH FROM (
              NOW() - $1::timestamptz
            )
          )::INTEGER - $2
        ) AS segundos
        `,
        [
          atividade.iniciada_em,
          totalPausadoSegundos,
        ]
      )

    const duracaoSegundos =
      Number(
        calculoTempo.rows[0]
          .segundos
      )

    const duracaoMinutos =
      Math.max(
        1,
        Math.ceil(
          duracaoSegundos / 60
        )
      )

    const registro =
      await client.query(
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
          CURRENT_DATE,
          $3::timestamptz,
          NOW(),
          $4,
          $5,
          'Cronômetro',
          $6
        )
        RETURNING *
        `,
        [
          atividade.tarefa_id,
          usuarioId,
          atividade.iniciada_em,
          duracaoMinutos,
          atividade.atividade,
          atividade.descricao,
        ]
      )

    await client.query(
      `
      DELETE FROM atividades_ativas
      WHERE usuario_id = $1
      `,
      [usuarioId]
    )

    await client.query('COMMIT')

    return res.json({
      mensagem:
        'Atividade concluída com sucesso.',
      duracaoSegundos,
      duracaoMinutos,
      registro:
        registro.rows[0],
    })
  } catch (erro) {
    await client.query('ROLLBACK')

    console.error(
      'Erro ao concluir atividade:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao concluir atividade.',
    })
  } finally {
    client.release()
  }
}

export async function listarAtividadesAtivas(
  req: Request,
  res: Response
) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        aa.id,
        aa.usuario_id,
        u.nome AS usuario_nome,
        u.perfil,
        u.setor,

        aa.tarefa_id,
        t.titulo AS tarefa_titulo,

        aa.atividade,
        aa.descricao,

        aa.iniciada_em,
        aa.pausado,
        aa.pausa_iniciada_em,
        aa.total_pausado_segundos,

        GREATEST(
          0,
          EXTRACT(
            EPOCH FROM (
              NOW() - aa.iniciada_em
            )
          )::INTEGER
          -
          aa.total_pausado_segundos
          -
          CASE
            WHEN aa.pausado = true
              AND aa.pausa_iniciada_em IS NOT NULL
            THEN
              EXTRACT(
                EPOCH FROM (
                  NOW() - aa.pausa_iniciada_em
                )
              )::INTEGER
            ELSE 0
          END
        ) AS tempo_ativo_segundos

      FROM atividades_ativas aa

      INNER JOIN usuarios u
        ON u.id = aa.usuario_id

      LEFT JOIN tarefas t
        ON t.id = aa.tarefa_id

      WHERE u.ativo = true

      ORDER BY u.nome
      `
    )

    return res.json({
      atividades: resultado.rows,
    })
  } catch (erro) {
    console.error(
      'Erro ao listar atividades ativas:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao listar atividades ativas.',
    })
  }
}