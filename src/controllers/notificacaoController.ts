import type {
  Request,
  Response,
} from 'express'

import {
  pool,
} from '../database.js'

import {
  criarNotificacao,
} from '../services/notificacoesService'

export async function listarNotificacoesUsuario(
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
          n.id,
          n.usuario_id,
          n.tarefa_id,
          n.tipo,
          n.titulo,
          n.mensagem,
          n.lida,
          n.criado_em,
          t.titulo AS tarefa_titulo

        FROM notificacoes n

        LEFT JOIN tarefas t
          ON t.id = n.tarefa_id

        WHERE n.usuario_id = $1

        ORDER BY
          n.lida ASC,
          n.criado_em DESC

        LIMIT 100
        `,
        [usuarioId]
      )

    return res.json({
      notificacoes:
        resultado.rows,
    })
  } catch (erro) {
    console.error(
      'Erro ao listar notificações:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao listar notificações.',
    })
  }
}

export async function marcarNotificacaoComoLida(
  req: Request,
  res: Response
) {
  try {
    const id =
      Number(req.params.id)

    if (!id) {
      return res.status(400).json({
        mensagem:
          'Notificação inválida.',
      })
    }

    const resultado =
      await pool.query(
        `
        UPDATE notificacoes
        SET lida = true
        WHERE id = $1
        RETURNING *
        `,
        [id]
      )

    if (
      resultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Notificação não encontrada.',
      })
    }

    return res.json({
      notificacao:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao marcar notificação como lida:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao atualizar notificação.',
    })
  }
}

export async function criarNotificacaoTeste(
  req: Request,
  res: Response
) {
  try {
    const {
      usuarioId,
      tarefaId,
      titulo,
      mensagem,
    } = req.body ?? {}

    if (
      !usuarioId ||
      !titulo ||
      !mensagem
    ) {
      return res.status(400).json({
        mensagem:
          'Usuário, título e mensagem são obrigatórios.',
      })
    }

    const notificacao =
      await criarNotificacao({
        usuarioId:
          Number(usuarioId),

        tarefaId:
          tarefaId
            ? Number(tarefaId)
            : null,

        tipo: 'teste',

        titulo,

        mensagem,
      })

    return res.status(201).json({
      notificacao,
    })
  } catch (erro) {
    console.error(
      'Erro ao criar notificação de teste:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao criar notificação.',
    })
  }
}