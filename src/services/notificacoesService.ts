import {
  pool,
} from '../database.js'

type CriarNotificacaoParams = {
  usuarioId: number
  tarefaId?: number | null
  tipo: string
  titulo: string
  mensagem: string
}

export async function criarNotificacao({
  usuarioId,
  tarefaId = null,
  tipo,
  titulo,
  mensagem,
}: CriarNotificacaoParams) {
  const resultado =
    await pool.query(
      `
      INSERT INTO notificacoes (
        usuario_id,
        tarefa_id,
        tipo,
        titulo,
        mensagem
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING *
      `,
      [
        usuarioId,
        tarefaId,
        tipo,
        titulo,
        mensagem,
      ]
    )

  return resultado.rows[0]
}