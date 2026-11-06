import {
  Router,
} from 'express'

import {
  buscarAulaAtualSala,
  registrarConferenciaSala,
  buscarPainelSalas,
  alterarStatusAtendimentoSala,
  enviarLembreteSala,
  registrarPingSala
} from '../controllers/SalasController'

const router =
  Router()
  
router.get(
  '/painel',
  buscarPainelSalas
)

router.patch(
  '/conferencias/:id/status',
  alterarStatusAtendimentoSala
)


router.get(
  '/:id/aula-atual',
  buscarAulaAtualSala
)

router.post(
  '/:id/conferencias',
  registrarConferenciaSala
)

router.post(
  '/:id/lembrete',
  enviarLembreteSala
)

router.post(
  '/:id/ping',
  registrarPingSala
)

export default router