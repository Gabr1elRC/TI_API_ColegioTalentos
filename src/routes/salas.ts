import {
  Router,
} from 'express'

import {
  buscarAulaAtualSala,
  registrarConferenciaSala,
} from '../controllers/SalasController'

const router =
  Router()
  

router.get(
  '/:id/aula-atual',
  buscarAulaAtualSala
)

router.post(
  '/:id/conferencias',
  registrarConferenciaSala
)

export default router