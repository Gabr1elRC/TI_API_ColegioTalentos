import {
  Router,
} from 'express'


import {
  listarNotificacoesUsuario,
  marcarNotificacaoComoLida,
  criarNotificacaoTeste,
} from '../controllers/notificacaoController'

const router =
  Router()

router.get(
  '/usuario/:usuarioId',
  listarNotificacoesUsuario
)

router.patch(
  '/:id/lida',
  marcarNotificacaoComoLida
)

router.post(
  '/teste',
  criarNotificacaoTeste
)

export default router