import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import tarefasRoutes from './routes/tarefas'
import authRoutes from './routes/auth.js'
import { pool } from './database'
import usuariosRoutes from './routes/usuarios'
import jornadaRoutes from './routes/jornada'
import notificacoesRoutes from './routes/notificacao'
import salasRoutes from './routes/salas'



const app = express()

app.use(cors())
app.use(express.json())

app.use(
  '/auth',
  authRoutes
)

app.use(
  '/usuarios',
  usuariosRoutes
)

app.use(
  '/jornada',
  jornadaRoutes
)

app.use('/tarefas', tarefasRoutes)

app.get('/', (_req, res) => {
  res.json({
    mensagem: 'API Talentos TI funcionando',
  })
})

app.use(
  '/salas',
  salasRoutes
)



app.get('/banco', async (_req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT NOW() AS agora'
    )

    res.json({
      mensagem:
        'Conexão com PostgreSQL realizada com sucesso',
      bancoOnline: true,
      horarioBanco:
        resultado.rows[0].agora,
    })
  } catch (erro) {
    console.error(
      'Erro ao conectar com o banco:',
      erro
    )

    res.status(500).json({
      mensagem:
        'Erro ao conectar com PostgreSQL',
    })
  }
})

app.use(
  '/notificacoes',
  notificacoesRoutes
)



const PORT =
  Number(process.env.PORT) || 3333

app.listen(PORT, () => {
  console.log(
    `Servidor rodando em http://localhost:${PORT}`
  )
})