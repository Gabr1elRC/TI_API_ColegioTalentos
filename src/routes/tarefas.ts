import { Router } from 'express'

import {
  listarTarefas,
  criarTarefa,
  alterarStatusTarefa,
  buscarTarefaPorId,
  adicionarComentario,
  adicionarRegistroTempo,
  adicionarRegistroTempoManual,
  listarRegistrosTempoHoje,
} from '../controllers/tarefasController'

const router = Router()

router.get('/', listarTarefas)

router.post('/', criarTarefa)

router.post(
  '/tempo/manual',
  adicionarRegistroTempoManual
)

router.get(
  '/usuarios/:usuarioId/tempo/hoje',
  listarRegistrosTempoHoje
)

router.get('/:id', buscarTarefaPorId)

router.patch(
  '/:id/status',
  alterarStatusTarefa
)

router.post(
  '/:id/tempo',
  adicionarRegistroTempo
)

router.post(
  '/:id/comentarios',
  adicionarComentario
)


export default router