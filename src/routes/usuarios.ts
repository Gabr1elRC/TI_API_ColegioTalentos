import {
  Router,
} from 'express'

import {
  listarUsuarios,criarUsuario,
} from '../controllers/usuariosController.js'

const router = Router()

router.post(
  '/',
  criarUsuario
)

router.get(
  '/',
  listarUsuarios
)

export default router