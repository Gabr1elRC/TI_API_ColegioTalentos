import {
  Router,
} from 'express'

import {
  listarUsuarios,
} from '../controllers/usuariosController.js'

const router = Router()

router.get(
  '/',
  listarUsuarios
)

export default router