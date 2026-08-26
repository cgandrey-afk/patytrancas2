from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Importa módulos internos
import firebase_config as fb
import gemini_service as gemini

app = FastAPI(title="Paty Tranças API", version="1.0.0")

# Habilita CORS para permitir que o Frontend da Vercel faça chamadas à API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Na Vercel, você pode restringir para seu domínio público
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/agenda/dias")
def listar_dias_disponiveis():
    agenda = fb.buscar_agenda_disponivel()
    # Retorna apenas as chaves (datas, ex: ["2026-08-12", "2026-08-13"])
    return list(agenda.keys())
    
@app.get("/api/agenda/horarios/{data}")
def listar_horarios_por_data(data: str):
    agenda = fb.buscar_agenda_disponivel()
    # Retorna os horários disponíveis daquela data específica
    return agenda.get(data, [])

# -------------------------------------------------------------
# MODELOS DE DADOS (Pydantic)
# -------------------------------------------------------------
class AgendamentoRequest(BaseModel):
    user_id: str
    cliente_nome: str
    cliente_telefone: str
    servico: str
    data_agendamento: str
    horario: str

class StatusUpdateRequest(BaseModel):
    user_id: str
    doc_id: str
    novo_status: str

class AgendaAbrirRequest(BaseModel):
    data: str
    horarios: List[str]

class ReagendarAprovadoRequest(BaseModel):
    user_id: str
    doc_id: str
    status_atual: str
    nova_data: str
    novo_horario: str

# -------------------------------------------------------------
# ROTAS DA API
# -------------------------------------------------------------

@app.get("/")
def home():
    return {"status": "online", "app": "Paty Tranças API"}

# --- BANNERS DINÂMICOS ---
@app.get("/api/banners")
def obter_banners():
    banners = fb.buscar_banners()
    if banners:
        return banners
    raise HTTPException(status_code=404, detail="Configuração de banners não encontrada.")

# --- AGENDAMENTOS (Agora por Usuário) ---
@app.get("/api/agendamentos/{user_id}")
def listar_agendamentos(user_id: str):
    return fb.carregar_agendamentos(user_id)
    
@app.get("/api/servicos")
def listar_servicos():
    return fb.carregar_servicos()

@app.post("/api/agendamentos")
def criar_agendamento(req: AgendamentoRequest):
    sucesso = fb.salvar_agendamento(
        req.user_id, 
        req.cliente_nome, 
        req.cliente_telefone, 
        req.servico, 
        req.data_agendamento, 
        req.horario
    )
    if sucesso:
        # Move o horário reservado de 'disponiveis' para 'indisponiveis'
        fb.mover_horario_para_indisponivel(req.data_agendamento, req.horario)
        return {"mensagem": "Agendamento realizado com sucesso!"}
    raise HTTPException(status_code=500, detail="Erro ao salvar agendamento.")
    
@app.get("/api/logo")
def obter_logo():
    logo = fb.buscar_logo()
    if logo:
        return logo
    raise HTTPException(status_code=404, detail="Logo não encontrada.")    


@app.get("/api/contato")
def obter_contato():
    try:
        doc = fb.db.collection("configuracoes").document("contato").get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Configurações de contato não encontradas.")
        return doc.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao buscar dados de contato.") 

@app.put("/api/agendamentos/status")
def atualizar_status(req: StatusUpdateRequest):
    fb.atualizar_status_agendamento(req.user_id, req.doc_id, req.novo_status)
    return {"mensagem": "Status atualizado!"}

# --- CANCELAMENTO CONDICIONAL ---
@app.delete("/api/agendamentos/cancelar/{user_id}/{doc_id}")
def cancelar_agendamento_rota(user_id: str, doc_id: str, status: str):
    resultado = fb.cancelar_agendamento_db(user_id, doc_id, status)
    if resultado:
        return resultado
    raise HTTPException(status_code=500, detail="Erro ao processar cancelamento.")

# --- SOLICITAÇÃO DE REAGENDAMENTO PARA APROVADOS ---
@app.post("/api/agendamentos/reagendar-aprovado")
def solicitar_reagendamento_rota(req: ReagendarAprovadoRequest):
    resultado = fb.solicitar_reagendamento_db(req.user_id, req.doc_id, req.status_atual, req.nova_data, req.novo_horario)
    if resultado:
        return resultado
    raise HTTPException(status_code=400, detail="Não foi possível solicitar o reagendamento.")

@app.delete("/api/agendamentos/{user_id}/{doc_id}")
def deletar_agendamento(user_id: str, doc_id: str):
    fb.deletar_agendamento(user_id, doc_id)
    return {"mensagem": "Agendamento excluído!"}

# --- AGENDA DE HORÁRIOS ---
@app.get("/api/agenda")
def listar_agenda_disponivel():
    return fb.buscar_agenda_disponivel()

@app.post("/api/agenda")
def abrir_agenda_data(req: AgendaAbrirRequest):
    fb.salvar_agenda(req.data, req.horarios)
    return {"mensagem": f"Agenda aberta para {req.data}"}

@app.delete("/api/agenda/{data_str}")
def deletar_agenda_data(data_str: str):
    fb.deletar_agenda(data_str)
    return {"mensagem": f"Agenda do dia {data_str} removida."}

# --- ANÁLISE COM GEMINI IA ---
@app.post("/api/analisar-ia")
async def analisar_penteado(foto: UploadFile = File(...)):
    if not foto.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Arquivo enviado não é uma imagem válida.")
    
    bytes_imagem = await foto.read()
    resultado = gemini.analisar_imagem_com_gemini(bytes_imagem)
    
    if resultado:
        return resultado
    raise HTTPException(status_code=500, detail="Falha na análise da imagem pela IA.")