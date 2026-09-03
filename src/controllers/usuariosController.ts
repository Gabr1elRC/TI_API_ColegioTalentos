import type {
  Request,
  Response,
} from 'express'

import { pool } from '../database.js'

export async function listarUsuarios(
  req: Request,
  res: Response
) {
  try {
    const resultado =
      await pool.query(
        `
        SELECT
          id,
          nome,
          email,
          perfil,
          setor,
          ativo,
          criado_em
        FROM usuarios
        ORDER BY nome
        `
      )

    return res.json({
      usuarios: resultado.rows,
    })
  } catch (erro) {
    console.error(
      'Erro ao listar usuários:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao listar usuários.',
    })
  }
}