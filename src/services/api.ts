
const API_URL = 'http://localhost:3333'

export async function buscarTarefas() {
  const resposta = await fetch(
    `${API_URL}/tarefas`
  )

  if (!resposta.ok) {
    throw new Error(
      'Erro ao buscar tarefas'
    )
  }

  return resposta.json()
}