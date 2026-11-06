import type {
  Request,
  Response,
} from 'express'

import {
  criarNotificacao,
} from '../services/notificacoesService.js'

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

    /*
     * =========================
     * VALIDAÇÕES
     * =========================
     */

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
     * =========================
     * BUSCA SALA E TURMA
     * =========================
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
     * =========================
     * BUSCA AULA ATUAL
     * =========================
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
          )::time >= h.hora_inicio

          AND (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::time < h.hora_fim

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
     * =========================
     * CONFERE DUPLICIDADE
     * =========================
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

          AND data_aula = (
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
     * =========================
     * REGISTRA CONFERÊNCIA
     * =========================
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
          atendimento_status,
          data_aula
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
          $10,
          (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::date
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
            ? descricao.trim()
            : null,

          status === 'SUPORTE'
            ? 'PENDENTE'
            : null,
        ]
      )

    /*
     * =========================
     * NOTIFICA ANALISTAS
     * =========================
     */

    if (
      status === 'SUPORTE'
    ) {
      try {
        const analistas =
          await pool.query(
            `
            SELECT id

            FROM usuarios

            WHERE perfil = 'analista'
              AND ativo = true
            `
          )

        for (
          const analista
          of analistas.rows
        ) {
          await criarNotificacao({
            usuarioId:
              Number(
                analista.id
              ),

            tarefaId:
              null,

            tipo:
              'suporte_sala',

            titulo:
              `Suporte solicitado - ${sala.sala_nome}`,

            mensagem:
              `${sala.turma_nome} | ${horario.disciplina} | Prof. ${horario.professor} | ${descricao.trim()}`,
          })
        }
      } catch (
        erroNotificacao
      ) {
        /*
         * A conferência já foi
         * registrada.
         *
         * Um erro na notificação
         * não deve apagar ou
         * invalidar a solicitação.
         */
        console.error(
          'Erro ao notificar analistas sobre suporte da sala:',
          erroNotificacao
        )
      }
    }

    /*
     * =========================
     * RESPOSTA
     * =========================
     */

    return res
      .status(201)
      .json({
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
  } catch (erro: any) {
    console.error(
      'Erro ao registrar conferência da sala:',
      erro
    )

    /*
     * O índice UNIQUE do banco
     * é a última proteção contra
     * conferência duplicada.
     */
    if (
      erro?.code === '23505'
    ) {
      return res.status(409).json({
        mensagem:
          'Esta aula já foi conferida.',
      })
    }

    return res.status(500).json({
      mensagem:
        'Erro ao registrar conferência da sala.',
    })
  }
}

export async function buscarPainelSalas(
  req: Request,
  res: Response
) {
  try {
    const resultado =
      await pool.query(`
        SELECT
          s.id AS sala_id,
          s.nome AS sala_nome,
          s.codigo AS sala_codigo,
          s.ultimo_ping,

          t.id AS turma_id,
          t.nome AS turma_nome,

          h.id AS horario_id,
          h.disciplina,
          h.professor,
          h.hora_inicio,
          h.hora_fim,

          c.id AS conferencia_id,
          c.status AS conferencia_status,
          c.descricao,
          c.atendimento_status,
          c.registrado_em
          

        FROM salas s

        LEFT JOIN turmas t
          ON t.sala_id = s.id
          AND t.ativo = true

        LEFT JOIN horarios_turma h
          ON h.turma_id = t.id
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
          )::time >= h.hora_inicio

          AND (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::time < h.hora_fim

        LEFT JOIN LATERAL (
          SELECT
            c2.id,
            c2.status,
            c2.descricao,
            c2.atendimento_status,
            c2.registrado_em

          FROM conferencias_sala c2

          WHERE c2.sala_id = s.id

            AND (
              c2.registrado_em
              AT TIME ZONE
              'America/Sao_Paulo'
            )::date =
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE
              'America/Sao_Paulo'
            )::date

            AND (
              h.id IS NULL
              OR c2.horario_id = h.id
            )

          ORDER BY
            c2.registrado_em DESC

          LIMIT 1
        ) c ON true

        WHERE s.ativo = true

        ORDER BY s.nome
      `)

    const salas =
      resultado.rows.map(
        (item) => {
          let situacao:
            | 'SEM_TURMA'
            | 'SEM_AULA'
            | 'AGUARDANDO'
            | 'SUPORTE'
            | 'RESOLVIDO'
            | 'OK' =
            'SEM_AULA'

          if (
            !item.turma_id
          ) {
            situacao =
              'SEM_TURMA'
          } else if (
            !item.horario_id
          ) {
            situacao =
              'SEM_AULA'
          } else if (
            !item.conferencia_id
          ) {
            situacao =
              'AGUARDANDO'
          } else if (
            item.conferencia_status ===
              'SUPORTE' &&
            item.atendimento_status ===
              'RESOLVIDO'
          ) {
            situacao =
              'RESOLVIDO'
          } else if (
            item.conferencia_status ===
            'SUPORTE'
          ) {
            situacao =
              'SUPORTE'
          } else if (
            item.conferencia_status ===
            'OK'
          ) {
            situacao =
              'OK'
          }

          return {
            sala: {
              id:
                Number(
                  item.sala_id
                ),

              nome:
                item.sala_nome,

              codigo:
                item.sala_codigo,

              ultimoPing:
                item.ultimo_ping,
            },

            turma:
              item.turma_id
                ? {
                    id:
                      Number(
                        item.turma_id
                      ),

                    nome:
                      item.turma_nome,
                  }
                : null,

            aulaAtual:
              item.horario_id
                ? {
                    horarioId:
                      Number(
                        item.horario_id
                      ),

                    disciplina:
                      item.disciplina,

                    professor:
                      item.professor,

                    horaInicio:
                      item.hora_inicio,

                    horaFim:
                      item.hora_fim,
                  }
                : null,

            conferencia:
              item.conferencia_id
                ? {
                    id:
                      Number(
                        item.conferencia_id
                      ),

                    status:
                      item.conferencia_status,

                    descricao:
                      item.descricao,

                    atendimentoStatus:
                      item.atendimento_status,

                    registradoEm:
                      item.registrado_em,
                  }
                : null,

            situacao,
          }
        }
      )

    return res.json({
      salas,
    })
  } catch (erro) {
    console.error(
      'Erro ao buscar painel de salas:',
      erro
    )

    return res
      .status(500)
      .json({
        mensagem:
          'Erro ao buscar painel de salas.',
      })
  }
}


export async function alterarStatusAtendimentoSala(
  req: Request,
  res: Response
) {
  try {
    const conferenciaId =
      Number(req.params.id)

    const {
      atendimentoStatus,
    } = req.body ?? {}

    const statusPermitidos = [
      'PENDENTE',
      'EM_ATENDIMENTO',
      'RESOLVIDO',
    ]

    if (
      !conferenciaId ||
      !statusPermitidos.includes(
        atendimentoStatus
      )
    ) {
      return res.status(400).json({
        mensagem:
          'Status de atendimento inválido.',
      })
    }

    const conferenciaResultado =
      await pool.query(
        `
        SELECT
          c.id,
          c.sala_id,
          c.status,
          c.atendimento_status,
          c.descricao,
          s.nome AS sala_nome

        FROM conferencias_sala c

        INNER JOIN salas s
          ON s.id = c.sala_id

        WHERE c.id = $1

        LIMIT 1
        `,
        [conferenciaId]
      )

    if (
      conferenciaResultado.rows.length ===
      0
    ) {
      return res.status(404).json({
        mensagem:
          'Conferência não encontrada.',
      })
    }

    const conferencia =
      conferenciaResultado.rows[0]

    if (
      conferencia.status !==
      'SUPORTE'
    ) {
      return res.status(400).json({
        mensagem:
          'Esta conferência não possui solicitação de suporte.',
      })
    }

    const resultado =
      await pool.query(
        `
        UPDATE conferencias_sala

        SET atendimento_status = $1

        WHERE id = $2

        RETURNING *
        `,
        [
          atendimentoStatus,
          conferenciaId,
        ]
      )

    /*
     * Notifica o usuário da sala
     * sobre a mudança no atendimento.
     */
    try {
      const usuarioSalaResultado =
        await pool.query(
          `
          SELECT
            id

          FROM usuarios

          WHERE perfil = 'sala'
            AND sala_id = $1
            AND ativo = true

          LIMIT 1
          `,
          [
            conferencia.sala_id,
          ]
        )

      if (
        usuarioSalaResultado.rows.length >
        0
      ) {
        const usuarioSala =
          usuarioSalaResultado.rows[0]

        let titulo =
          'Atualização do suporte'

        let mensagem =
          `O atendimento da ${conferencia.sala_nome} foi atualizado.`

        if (
          atendimentoStatus ===
          'EM_ATENDIMENTO'
        ) {
          titulo =
            'Suporte em atendimento'

          mensagem =
            'A equipe de TI iniciou o atendimento da sua solicitação.'
        }

        if (
          atendimentoStatus ===
          'RESOLVIDO'
        ) {
          titulo =
            'Suporte resolvido'

          mensagem =
            'A equipe de TI informou que o atendimento foi resolvido.'
        }

        if (
          atendimentoStatus ===
          'PENDENTE'
        ) {
          titulo =
            'Suporte pendente'

          mensagem =
            'A solicitação de suporte está aguardando atendimento.'
        }

        await criarNotificacao({
          usuarioId:
            Number(
              usuarioSala.id
            ),

          tarefaId:
            null,

          tipo:
            'suporte_sala_status',

          titulo,

          mensagem,
        })
      }
    } catch (
      erroNotificacao
    ) {
      console.error(
        'Erro ao notificar sala sobre status do atendimento:',
        erroNotificacao
      )
    }

    return res.json({
      mensagem:
        'Status do atendimento atualizado com sucesso.',

      conferencia:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao alterar status do atendimento da sala:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao alterar status do atendimento.',
    })
  }
}


export async function enviarLembreteSala(
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
     * Busca a sala, turma e
     * verifica se existe aula
     * acontecendo neste momento.
     */
    const salaResultado =
      await pool.query(
        `
        SELECT
          s.id,
          s.nome,

          t.id AS turma_id,
          t.nome AS turma_nome,

          h.id AS horario_id,
          h.disciplina,
          h.professor,
          h.hora_inicio,
          h.hora_fim

        FROM salas s

        LEFT JOIN turmas t
          ON t.sala_id = s.id
          AND t.ativo = true

        LEFT JOIN horarios_turma h
          ON h.turma_id = t.id
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
          )::time >= h.hora_inicio

          AND (
            CURRENT_TIMESTAMP
            AT TIME ZONE
            'America/Sao_Paulo'
          )::time < h.hora_fim

        WHERE s.id = $1
          AND s.ativo = true

        LIMIT 1
        `,
        [salaId]
      )

    if (
      salaResultado.rows.length ===
      0
    ) {
      return res.status(404).json({
        mensagem:
          'Sala não encontrada.',
      })
    }

    const sala =
      salaResultado.rows[0]

    /*
     * Sem turma vinculada,
     * não existe conferência.
     */
    if (!sala.turma_id) {
      return res.status(400).json({
        mensagem:
          'Esta sala não possui turma vinculada.',
      })
    }

    /*
     * Sem aula acontecendo agora,
     * não envia lembrete.
     */
    if (!sala.horario_id) {
      return res.status(400).json({
        mensagem:
          'Não existe aula em andamento nesta sala.',
      })
    }

    /*
     * Verifica se a aula já
     * foi conferida hoje.
     */
    const conferenciaResultado =
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
          sala.horario_id,
        ]
      )

    if (
      conferenciaResultado.rows.length >
      0
    ) {
      return res.status(409).json({
        mensagem:
          'Esta aula já foi conferida.',
      })
    }

    /*
     * Busca o usuário vinculado
     * ao computador da sala.
     */
    const usuarioSalaResultado =
      await pool.query(
        `
        SELECT id

        FROM usuarios

        WHERE perfil = 'sala'
          AND sala_id = $1
          AND ativo = true

        LIMIT 1
        `,
        [salaId]
      )

    if (
      usuarioSalaResultado.rows.length ===
      0
    ) {
      return res.status(404).json({
        mensagem:
          'Esta sala ainda não possui usuário vinculado.',
      })
    }

    const usuarioSala =
      usuarioSalaResultado.rows[0]

    await criarNotificacao({
      usuarioId:
        Number(
          usuarioSala.id
        ),

      tarefaId:
        null,

      tipo:
        'lembrete_sala',

      titulo:
        'Confirmação da sala',

      mensagem:
        `Confirme as condições da ${sala.nome} durante a aula de ${sala.disciplina}.`,
    })

    return res.json({
      mensagem:
        'Lembrete enviado com sucesso.',

      aula: {
        sala:
          sala.nome,

        turma:
          sala.turma_nome,

        disciplina:
          sala.disciplina,

        professor:
          sala.professor,

        horaInicio:
          sala.hora_inicio,

        horaFim:
          sala.hora_fim,
      },
    })
  } catch (erro) {
    console.error(
      'Erro ao enviar lembrete para a sala:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao enviar lembrete para a sala.',
    })
  }
}

export async function registrarPingSala(
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

    const resultado =
      await pool.query(
        `
        UPDATE salas

        SET
          ultimo_ping =
            CURRENT_TIMESTAMP,
          atualizado_em =
            CURRENT_TIMESTAMP

        WHERE id = $1
          AND ativo = true

        RETURNING
          id,
          nome,
          ultimo_ping
        `,
        [salaId]
      )

    if (
      resultado.rows.length === 0
    ) {
      return res.status(404).json({
        mensagem:
          'Sala não encontrada.',
      })
    }

    return res.json({
      mensagem:
        'Ping registrado com sucesso.',

      sala: {
        id:
          Number(
            resultado.rows[0].id
          ),

        nome:
          resultado.rows[0].nome,

        ultimoPing:
          resultado.rows[0]
            .ultimo_ping,
      },
    })
  } catch (erro) {
    console.error(
      'Erro ao registrar ping da sala:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro ao registrar ping da sala.',
    })
  }
}