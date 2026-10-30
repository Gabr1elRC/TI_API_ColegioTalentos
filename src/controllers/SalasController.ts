import type {
  Request,
  Response,
} from 'express'

import {
  pool,
} from '../database.js'


export async function buscarAulaAtualSala(
  req: Request,
  res: Response
) {
  try {
    const salaId =
      Number(req.params.id)

    if (!salaId) {
      return res.status(400).json({
        mensagem:
          'Sala inválida.',
      })
    }

    /*
     * Primeiro buscamos a sala
     * e a turma atualmente
     * vinculada a ela.
     */
    const salaResultado =
      await pool.query(
        `
        SELECT
          s.id AS sala_id,
          s.nome AS sala_nome,
          s.codigo AS sala_codigo,

          t.id AS turma_id,
          t.nome AS turma_nome

        FROM salas s

        LEFT JOIN turmas t
          ON t.sala_id = s.id
          AND t.ativo = true

        WHERE s.id = $1
          AND s.ativo = true

        LIMIT 1
        `,
        [salaId]
      )

    if (
      salaResultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Sala não encontrada.',
      })
    }

    const sala =
      salaResultado.rows[0]

    /*
     * A sala existe,
     * mas atualmente não possui
     * nenhuma turma vinculada.
     */
    if (!sala.turma_id) {
      return res.json({
        sala: {
          id:
            Number(
              sala.sala_id
            ),

          nome:
            sala.sala_nome,

          codigo:
            sala.sala_codigo,
        },

        turma: null,

        aulaAtual: null,

        situacao:
          'SEM_TURMA',
      })
    }

    /*
     * Agora procuramos qual aula
     * dessa turma está acontecendo
     * neste momento.
     *
     * Usamos o horário de São Paulo
     * para não depender do fuso
     * configurado no servidor.
     */
    const horarioResultado =
      await pool.query(
        `
        SELECT
          h.id,
          h.hora_inicio,
          h.hora_fim,
          h.disciplina,
          h.professor

        FROM horarios_turma h

        WHERE h.turma_id = $1

          AND h.ativo = true

          AND h.dia_semana =
            EXTRACT(
              ISODOW
              FROM (
                CURRENT_TIMESTAMP
                AT TIME ZONE
                'America/Sao_Paulo'
              )
            )

          AND (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::time
          BETWEEN
            h.hora_inicio
            AND h.hora_fim

        ORDER BY
          h.hora_inicio ASC

        LIMIT 1
        `,
        [
          sala.turma_id,
        ]
      )

    /*
     * Existe turma na sala,
     * mas não existe aula
     * acontecendo neste momento.
     */
    if (
      horarioResultado.rows.length ===
      0
    ) {
      return res.json({
        sala: {
          id:
            Number(
              sala.sala_id
            ),

          nome:
            sala.sala_nome,

          codigo:
            sala.sala_codigo,
        },

        turma: {
          id:
            Number(
              sala.turma_id
            ),

          nome:
            sala.turma_nome,
        },

        aulaAtual: null,

        situacao:
          'SEM_AULA',
      })
    }

    const horario =
      horarioResultado.rows[0]

    return res.json({
      sala: {
        id:
          Number(
            sala.sala_id
          ),

        nome:
          sala.sala_nome,

        codigo:
          sala.sala_codigo,
      },

      turma: {
        id:
          Number(
            sala.turma_id
          ),

        nome:
          sala.turma_nome,
      },

      aulaAtual: {
        horarioId:
          Number(
            horario.id
          ),

        disciplina:
          horario.disciplina,

        professor:
          horario.professor,

        horaInicio:
          horario.hora_inicio,

        horaFim:
          horario.hora_fim,
      },

      situacao:
        'AULA_EM_ANDAMENTO',
    })
  } catch (erro) {
    console.error(
      'Erro ao buscar aula atual da sala:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao buscar aula atual da sala.',
    })
  }
}

export async function registrarConferenciaSala(
  req: Request,
  res: Response
) {
  try {
    const salaId =
      Number(req.params.id)

    const {
      status,
      descricao,
    } = req.body ?? {}

    if (!salaId) {
      return res.status(400).json({
        mensagem:
          'Sala inválida.',
      })
    }

    if (
      status !== 'OK' &&
      status !== 'SUPORTE'
    ) {
      return res.status(400).json({
        mensagem:
          'Status inválido.',
      })
    }

    if (
      status === 'SUPORTE' &&
      !descricao?.trim()
    ) {
      return res.status(400).json({
        mensagem:
          'Descreva o problema encontrado.',
      })
    }

    /*
     * Descobre qual turma está
     * vinculada à sala.
     */
    const salaResultado =
      await pool.query(
        `
        SELECT
          s.id AS sala_id,
          s.nome AS sala_nome,

          t.id AS turma_id,
          t.nome AS turma_nome

        FROM salas s

        LEFT JOIN turmas t
          ON t.sala_id = s.id
          AND t.ativo = true

        WHERE s.id = $1
          AND s.ativo = true

        LIMIT 1
        `,
        [salaId]
      )

    if (
      salaResultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Sala não encontrada.',
      })
    }

    const sala =
      salaResultado.rows[0]

    if (!sala.turma_id) {
      return res.status(400).json({
        mensagem:
          'Esta sala não possui turma vinculada.',
      })
    }

    /*
     * Descobre qual aula está
     * acontecendo neste momento.
     */
    const horarioResultado =
      await pool.query(
        `
        SELECT
          h.id,
          h.hora_inicio,
          h.hora_fim,
          h.disciplina,
          h.professor

        FROM horarios_turma h

        WHERE h.turma_id = $1
          AND h.ativo = true

          AND h.dia_semana =
            EXTRACT(
              ISODOW
              FROM (
                CURRENT_TIMESTAMP
                AT TIME ZONE
                'America/Sao_Paulo'
              )
            )

          AND (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::time
          BETWEEN
            h.hora_inicio
            AND h.hora_fim

        ORDER BY
          h.hora_inicio ASC

        LIMIT 1
        `,
        [
          sala.turma_id,
        ]
      )

    if (
      horarioResultado.rows.length ===
      0
    ) {
      return res.status(400).json({
        mensagem:
          'Não existe aula em andamento nesta sala.',
      })
    }

    const horario =
      horarioResultado.rows[0]

    /*
     * Verifica se essa aula já
     * foi conferida hoje.
     */
    const conferenciaExistente =
      await pool.query(
        `
        SELECT
          id,
          status,
          registrado_em

        FROM conferencias_sala

        WHERE sala_id = $1
          AND horario_id = $2

          AND (
            registrado_em
            AT TIME ZONE
            'America/Sao_Paulo'
          )::date =
          (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::date

        LIMIT 1
        `,
        [
          salaId,
          horario.id,
        ]
      )

    if (
      conferenciaExistente.rows.length >
      0
    ) {
      return res.status(409).json({
        mensagem:
          'Esta aula já foi conferida.',

        conferencia:
          conferenciaExistente.rows[0],
      })
    }

    /*
     * Registra a conferência.
     */
    const resultado =
      await pool.query(
        `
        INSERT INTO conferencias_sala (
          sala_id,
          turma_id,
          horario_id,
          professor,
          disciplina,
          hora_inicio,
          hora_fim,
          status,
          descricao,
          atendimento_status
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
          $10
        )
        RETURNING *
        `,
        [
          salaId,
          sala.turma_id,
          horario.id,
          horario.professor,
          horario.disciplina,
          horario.hora_inicio,
          horario.hora_fim,
          status,
          status === 'SUPORTE'
            ? 'PENDENTE'
            : null,
        ]
      )

/*
 * Se a sala solicitar suporte,
 * notifica todos os analistas ativos.
 */
if (status === 'SUPORTE') {
  try {

    console.log(
      'Criando notificação de suporte para:',
      sala.sala_nome,
      descricao
    )
    const analistas =
      await pool.query(
        `
        SELECT id
        FROM usuarios
        WHERE perfil = 'analista'
          AND ativo = true
        `
      )

    console.log(
      'Analistas encontrados:',
      analistas.rows
    )


    for (
      const analista
      of analistas.rows
    ) {
      await pool.query(
        `
        INSERT INTO notificacoes (
          usuario_id,
          tarefa_id,
          tipo,
          titulo,
          mensagem,
          lida
        )
        VALUES (
          $1,
          NULL,
          $2,
          $3,
          $4,
          false
        )
        `,
        [
          analista.id,
          'suporte_sala',
          `Suporte solicitado - ${sala.sala_nome}`,
          `${sala.turma_nome} | ${horario.disciplina} | Prof. ${horario.professor} | ${descricao.trim()}`,
        ]
      )
    }
  } catch (erroNotificacao) {
    console.error(
      'Erro ao criar notificação de suporte da sala:',
      erroNotificacao
    )
  }
}

    return res.status(201).json({
      mensagem:
        status === 'OK'
          ? 'Conferência registrada com sucesso.'
          : 'Solicitação de suporte registrada com sucesso.',

      conferencia:
        resultado.rows[0],

      aula: {
        sala:
          sala.sala_nome,

        turma:
          sala.turma_nome,

        professor:
          horario.professor,

        disciplina:
          horario.disciplina,

        horaInicio:
          horario.hora_inicio,

        horaFim:
          horario.hora_fim,
      },
    })
  } catch (erro) {
    console.error(
      'Erro ao registrar conferência da sala:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao registrar conferência da sala.',
    })
  }
}