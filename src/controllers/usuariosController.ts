import type {
  Request,
  Response,
} from 'express'
import bcrypt from 'bcryptjs'

import { pool } from '../database.js'

export async function criarUsuario(
  req: Request,
  res: Response
) {
  try {
    const {
      nome,
      email,
      senha,
      perfil,
      setor,
    } = req.body ?? {}

    if (
      !nome ||
      !email ||
      !senha ||
      !perfil
    ) {
      return res.status(400).json({
        mensagem:
          'Nome, e-mail, senha e perfil são obrigatórios.',
      })
    }

    const perfisPermitidos = [
      'analista',
      'estagiario',
      'direcao',
    ]

    if (
      !perfisPermitidos.includes(
        perfil
      )
    ) {
      return res.status(400).json({
        mensagem:
          'Perfil inválido.',
      })
    }

    const usuarioExistente =
      await pool.query(
        `
        SELECT id
        FROM usuarios
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      )

    if (
      usuarioExistente.rows.length >
      0
    ) {
      return res.status(409).json({
        mensagem:
          'Já existe um usuário com este e-mail.',
      })
    }

    const senhaHash =
      await bcrypt.hash(
        senha,
        10
      )

    const resultado =
      await pool.query(
        `
        INSERT INTO usuarios (
          nome,
          email,
          senha_hash,
          perfil,
          setor,
          ativo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          true
        )
        RETURNING
          id,
          nome,
          email,
          perfil,
          setor,
          ativo,
          criado_em
        `,
        [
          nome,
          email,
          senhaHash,
          perfil,
          setor || null,
        ]
      )

    return res.status(201).json({
      usuario:
        resultado.rows[0],
    })
  } catch (erro) {
    console.error(
      'Erro ao criar usuário:',
      erro
    )

    return res.status(500).json({
      mensagem:
        'Erro interno ao criar usuário.',
    })
  }
}

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