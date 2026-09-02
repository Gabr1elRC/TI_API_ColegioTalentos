import type {
  Request,
  Response,
} from 'express'

import bcrypt from 'bcryptjs'

import { pool } from '../database.js'

export async function login(
  req: Request,
  res: Response
) {
  try {
    const {
      email,
      senha,
    } = req.body ?? {}

    if (!email || !senha) {
      return res.status(400).json({
        mensagem:
          'E-mail e senha são obrigatórios.',
      })
    }

    const resultado =
      await pool.query(
        `
        SELECT
          id,
          nome,
          email,
          senha_hash,
          perfil,
          setor,
          ativo
        FROM usuarios
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      )

    if (
      resultado.rows.length === 0
    ) {
      return res.status(401).json({
        mensagem:
          'E-mail ou senha inválidos.',
      })
    }

    const usuario =
      resultado.rows[0]

    if (!usuario.ativo) {
      return res.status(403).json({
        mensagem:
          'Usuário inativo.',
      })
    }

    const senhaCorreta =
      await bcrypt.compare(
        senha,
        usuario.senha_hash
      )

    if (!senhaCorreta) {
      return res.status(401).json({
        mensagem:
          'E-mail ou senha inválidos.',
      })
    }

    return res.json({
      usuario: {
        id: Number(usuario.id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        setor: usuario.setor,
      },
    })
  } catch (erro) {
    console.error(
      'Erro no login:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao realizar login.',
    })
  }
}
