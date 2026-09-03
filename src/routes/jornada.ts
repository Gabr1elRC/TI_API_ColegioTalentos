import { Router } from 'express'

import {
  iniciarAtividade,pausarAtividade, retomarAtividade,concluirAtividade,listarAtividadesAtivas, resumoEquipeHoje,
} from '../controllers/JornadaController'

const router = Router()

router.post(
  '/iniciar',
  iniciarAtividade
)

router.patch(
  '/pausar',
  pausarAtividade
)

router.patch(
  '/retomar',
  retomarAtividade
)

router.post(
  '/concluir',
  concluirAtividade
)

router.get(
  '/ativas',
  listarAtividadesAtivas
)

router.get(
  '/resumo-hoje',
  resumoEquipeHoje
)

export default router