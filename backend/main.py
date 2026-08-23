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

# -------------------------------------------------------------
# MODELOS DE DADOS (Pydantic)
# -------------------------------------------------------------
class AgendamentoRequest(BaseModel):
    cliente_nome: str
    cliente_telefone: str
    servico: str
    data_agendamento: str
    horario: str

class StatusUpdateRequest(BaseModel):
    doc_id: str
    novo_status: str

class AgendaAbrirRequest(BaseModel):
    data: str
    horarios: List[str]

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

# --- AGENDAMENTOS ---
@app.get("/api/agendamentos")
def listar_agendamentos():
    return fb.carregar_agendamentos()

@app.post("/api/agendamentos")
def criar_agendamento(req: AgendamentoRequest):
    sucesso = fb.salvar_agendamento(
        req.cliente_nome, 
        req.cliente_telefone, 
        req.servico, 
        req.data_agendamento, 
        req.horario
    )
    if sucesso:
        # Atualiza a agenda removendo o horário reservado
        fb.remover_horario_agenda(req.data_agendamento, req.horario)
        return {"mensagem": "Agendamento realizado com sucesso!"}
    raise HTTPException(status_code=500, detail="Erro ao salvar agendamento.")

@app.put("/api/agendamentos/status")
def atualizar_status(req: StatusUpdateRequest):
    fb.atualizar_status_agendamento(req.doc_id, req.novo_status)
    return {"mensagem": "Status atualizado!"}

@app.delete("/api/agendamentos/{doc_id}")
def deletar_agendamento(doc_id: str):
    fb.deletar_agendamento(doc_id)
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