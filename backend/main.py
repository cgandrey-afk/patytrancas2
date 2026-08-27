from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import pytz

# Importa módulos internos
import firebase_config as fb
import gemini_service as gemini

# Gerenciador de ciclo de vida para ligar o monitoramento do Firebase ao iniciar a API
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Liga o observador em background para sincronizar a agenda automaticamente
    fb.iniciar_monitoramento_firestore()
    yield

app = FastAPI(title="Paty Tranças API", version="1.0.0", lifespan=lifespan)

# Habilita CORS para permitir que o Frontend da Vercel faça chamadas à API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Na Vercel, você pode restringir para seu domínio público
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/agenda/dias")
def listar_dias_disponiveis(servico: Optional[str] = None):
    # Converte string 'None' ou vazia para None real
    if not servico or servico.lower() == 'none' or servico.strip() == '':
        print("[DEBUG ROTA DIAS] Serviço não informado ou veio como 'None'. Assumindo duração padrão de 1h.")
        servico = None # Ou coloque o nome de um serviço padrão do seu banco se preferir
    else:
        print(f"[DEBUG ROTA DIAS] Serviço recebido via query string: '{servico}'")

    agenda = fb.buscar_agenda_disponivel()
    if not isinstance(agenda, dict):
        return []
    
    fuso_br = pytz.timezone("America/Sao_Paulo")
    hoje_str = datetime.now(fuso_br).strftime("%Y-%m-%d")
    
    # Se o serviço for None, usa 1.0 hora como padrão para não quebrar o calendário ao abrir a página
    duracao_horas = fb.obter_duracao_servico(servico) if servico else 1.0
    
    dias_validos = []
    for data, horarios in agenda.items():
        if data < hoje_str:
            continue
            
        if fb.tem_espaco_consecutivo(horarios, duracao_horas):
            dias_validos.append(data)
            
    dias_validos.sort()
    return dias_validos

@app.get("/api/agenda/horarios/{data}")
def listar_horarios_por_data(data: str, servico: Optional[str] = None):
    # Trata caso o serviço venha como string 'None', vazio ou nulo real
    if not servico or servico.lower() == 'none' or servico.strip() == '':
        print(f"[DEBUG ROTA HORARIOS] Serviço não informado ou 'None'. Assumindo duração padrão de 1.0h.")
        servico = None
    
    print(f"[DEBUG ROTA HORARIOS] Data: {data} | Serviço tratado: '{servico}'")
    
    fuso_br = pytz.timezone("America/Sao_Paulo")
    agora = datetime.now(fuso_br)
    hoje_str = agora.strftime("%Y-%m-%d")
    
    # Bloqueia apenas se for uma data passada
    if data < hoje_str:
        print(f"[DEBUG ROTA HORARIOS] Bloqueado por data passada ({data < hoje_str})")
        return []

    if data == hoje_str:
        fb.verificar_e_aplicar_corte_10min(data)

    agenda = fb.buscar_agenda_disponivel()
    horarios_salvos = agenda.get(data, [])
    print(f"[DEBUG ROTA HORARIOS] Horários salvos brutos no banco para {data}: {horarios_salvos}")
    
    # Se o serviço for None, usa 1 hora como padrão para calcular os blocos
    duracao_horas = fb.obtener_duracao_servico(servico) if servico else 1.0
    horarios_validos = fb.filtrar_horarios_iniciais_sequenciais(horarios_salvos, duracao_horas)
    
    print(f"[DEBUG ROTA HORARIOS] Horários finais devolvidos: {horarios_validos}")
    return horarios_validos

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
    agendamentos = fb.carregar_agendamentos(user_id)
    if isinstance(agendamentos, list):
        # Filtra para remover da tela do cliente os agendamentos que estão cancelados
        return [ag for ag in agendamentos if ag.get("status") != "Cancelado"]
    return agendamentos
    
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
        # Move o horário de disponível para indisponível (ou bloqueia o intervalo do serviço)
        fb.mover_horario_para_indisponivel(req.data_agendamento, req.horario, req.servico)
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
    fb.atualizar_status_agendamento(req.doc_id, req.novo_status)
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