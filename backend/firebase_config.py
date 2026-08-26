import os
import json
import threading
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Inicialização do Firebase Admin
if not firebase_admin._apps:
    # No Render ou local, pegaremos as credenciais de uma variável de ambiente JSON
    firebase_json = os.environ.get("FIREBASE_CREDENTIALS")
    if firebase_json:
        cred_dict = json.loads(firebase_json)
        if "private_key" in cred_dict:
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    else:
        # Fallback para arquivo local durante o desenvolvimento
        cred = credentials.Certificate("firebase_key.json")
        firebase_admin.initialize_app(cred)

db = firestore.client()

def carregar_agendamentos(user_id: str):
    try:
        # Busca agendamentos apenas dentro da subcoleção do usuário específico
        docs = db.collection("usuarios").document(user_id).collection("agendamentos").stream()
        lista = []
        for doc in docs:
            d = doc.to_dict()
            d["id"] = doc.id
            lista.append(d)
        return lista
    except Exception as e:
        print(f"Erro ao carregar agendamentos do usuário: {e}")
        return []

def carregar_servicos():
    try:
        docs = db.collection("servicos").stream()
        servicos = []
        for doc in docs:
            dados = doc.to_dict()
            if "nome" not in dados or not dados["nome"]:
                dados["nome"] = doc.id
            dados["id"] = doc.id
            # Garante que o serviço tenha um campo de duração padrão (ex: 1 hora se não especificado)
            if "duracao_horas" not in dados:
                dados["duracao_horas"] = 1
            servicos.append(dados)
        return servicos
    except Exception as e:
        print(f"Erro ao carregar serviços: {e}")
        return []

def obter_duracao_servico(nome_servico: str):
    """Busca quantas horas o serviço dura baseando-se no banco de dados"""
    try:
        doc = db.collection("servicos").document(nome_servico).get()
        if doc.exists:
            return doc.to_dict().get("duracao_horas", 1)
        
        servicos = carregar_servicos()
        for s in servicos:
            if s.get("nome") == nome_servico or s.get("id") == nome_servico:
                return s.get("duracao_horas", 1)
        return 1
    except Exception as e:
        print(f"Erro ao buscar duração do serviço: {e}")
        return 1

def calcular_blocos_horarios(horario_inicial: str, duracao_horas: int):
    """Gera a lista de horários ocupados com base na hora inicial e duração (ex: '8:00' + 3h -> ['8:00', '9:00', '10:00'])"""
    try:
        hora_str = horario_inicial.split(":")[0]
        h_inicial = int(hora_str)
        
        horarios_gerados = []
        for i in range(duracao_horas):
            hora_atual = h_inicial + i
            horarios_gerados.append(f"{hora_atual}:00")
            
        return horarios_gerados
    except Exception as e:
        print(f"Erro ao calcular blocos de horários: {e}")
        return [horario_inicial]

def salvar_agendamento(user_id, nome, telefone, servico, data_agend, horario):
    try:
        # Descobre a duração e calcula todos os blocos ocupados
        duracao = obter_duracao_servico(servico)
        lista_horarios = calcular_blocos_horarios(horario, duracao)

        novo_registro = {
            "cliente_nome": nome,
            "cliente_telefone": telefone,
            "servico": servico,
            "data_agendamento": str(data_agend),
            "horario": horario,
            "horarios_ocupados": lista_horarios, # Salva a lista completa (ex: ["8:00", "9:00", "10:00"])
            "status": "Pendente",
            "criado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        
        db.collection("usuarios").document(user_id).collection("agendamentos").add(novo_registro)
        return True
    except Exception as e:
        print(f"Erro ao salvar agendamento: {e}")
        return False
    
def buscar_logo():
    try:
        doc = db.collection("configuracoes").document("logo").get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Erro ao buscar logo: {e}")
        return None
        
def buscar_contato():
    try:
        doc = db.collection("configuracoes").document("contato").get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Erro ao buscar contato: {e}")
        return None
    
def buscar_banners():
    doc_ref = db.collection("configuracoes").document("banners")
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {"ativo": False}

def atualizar_status_agendamento(doc_id, novo_status):
    db.collection("agendamentos").document(doc_id).update({"status": novo_status})

def deletar_agendamento(doc_id):
    db.collection("agendamentos").document(doc_id).delete()

def buscar_agenda_disponivel():
    agenda = {}
    docs = db.collection("agenda").stream()
    
    for doc in docs:
        dados = doc.to_dict()
        data_str = doc.id or dados.get("data")
        
        trabalho = dados.get("horarios_de_trabalho", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        if trabalho:
            disponiveis_calculados = [h for h in trabalho if h not in indisponiveis]
        else:
            disponiveis_calculados = dados.get("horarios_disponiveis", [])

        if data_str and disponiveis_calculados:
            agenda[data_str] = disponiveis_calculados
            
    return agenda

def salvar_agenda(data_str, horarios_trabalho):
    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    
    if doc.exists:
        dados = doc.to_dict()
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        disponiveis = [h for h in horarios_trabalho if h not in indisponiveis]
        
        doc_ref.set({
            "data": data_str,
            "horarios_de_trabalho": horarios_trabalho,
            "horarios_disponiveis": disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        }, merge=True)
    else:
        doc_ref.set({
            "data": data_str,
            "horarios_de_trabalho": horarios_trabalho,
            "horarios_disponiveis": horarios_trabalho,
            "horarios_indisponiveis": [],
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

def mover_horario_para_indisponivel(data_str, horario_inicial, servico):
    """Move todos os blocos de horários correspondentes à duração do serviço para indisponíveis"""
    duracao = obter_duracao_servico(servico)
    horarios_a_bloquear = calcular_blocos_horarios(horario_inicial, duracao)

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    if doc.exists:
        dados = doc.to_dict()
        disponiveis = dados.get("horarios_disponiveis", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        for h in horarios_a_bloquear:
            if h in disponiveis:
                disponiveis.remove(h)
            if h not in indisponiveis:
                indisponiveis.append(h)
            
        doc_ref.update({
            "horarios_disponiveis": disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

def voltar_horario_para_disponivel(data_str, horario_inicial, servico):
    """Devolve todos os blocos de horários do serviço cancelado para a lista de disponíveis"""
    duracao = obter_duracao_servico(servico)
    horarios_a_liberar = calcular_blocos_horarios(horario_inicial, duracao)

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    if doc.exists:
        dados = doc.to_dict()
        disponiveis = dados.get("horarios_disponiveis", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        trabalho = dados.get("horarios_de_trabalho", [])
        
        for h in horarios_a_liberar:
            if h in indisponiveis:
                indisponiveis.remove(h)
            if h not in disponiveis and h in trabalho:
                disponiveis.append(h)
                
        disponiveis.sort(key=lambda x: int(x.split(":")[0]))
            
        doc_ref.update({
            "horarios_disponiveis": disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

def deletar_agenda(data_str):
    db.collection("agenda").document(data_str).delete()

# --- MONITORAMENTO EM TEMPO REAL ---
def processar_atualizacao_automatica(doc_ref, dados):
    try:
        trabalho = dados.get("horarios_de_trabalho", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        disponiveis_atuais = dados.get("horarios_disponiveis", [])
        
        if not trabalho:
            return

        disponiveis_calculados = [h for h in trabalho if h not in indisponiveis]

        if disponiveis_atuais != disponiveis_calculados or "horarios_disponiveis" not in dados:
            doc_ref.set({
                "horarios_disponiveis": disponiveis_calculados,
                "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
            }, merge=True)
    except Exception as e:
        print(f"Erro na sincronização automática da agenda: {e}")

def monitorar_agenda_callback(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name in ('ADDED', 'MODIFIED'):
            processar_atualizacao_automatica(change.document.reference, change.document.to_dict())

def iniciar_monitoramento_firestore():
    try:
        db.collection("agenda").on_snapshot(monitorar_agenda_callback)
        print("[DB] Monitoramento automático da agenda ativado.")
    except Exception as e:
        print(f"Erro ao ligar monitoramento do Firestore: {e}")
# ------------------------------------------------------------------------------------

def cancelar_agendamento_db(user_id: str, doc_id: str, status_atual: str):
    try:
        doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        doc_dados = doc_ref.get()
        
        data_agend = None
        horario = None
        servico = None
        if doc_dados.exists:
            d = doc_dados.to_dict()
            data_agend = d.get("data_agendamento")
            horario = d.get("horario")
            servico = d.get("servico")

        if status_atual == "Pendente":
            doc_ref.delete()
            if data_agend and horario and servico:
                voltar_horario_para_disponivel(data_agend, horario, servico)
            return {"acao": "deletado", "mensagem": "Agendamento cancelado e removido."}
        else:
            doc_ref.update({
                "pedido_cancelamento": True,
                "status_cancelamento": "Pendente"
            })
            return {"acao": "solicitado", "mensagem": "Solicitação de cancelamento enviada à administração."}
    except Exception as e:
        print(f"Erro ao cancelar agendamento: {e}")
        return None

def solicitar_reagendamento_db(user_id: str, doc_id: str, status_atual: str, nova_data: str, novo_horario: str):
    try:
        doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        if status_atual == "Aprovado":
            doc_ref.update({
                "pedido_reagendamento": True,
                "status_reag": "Pendente",
                "novo_data": nova_data,
                "novo_horario": novo_horario
            })
            return {"acao": "solicitado", "mensagem": "Solicitação de reagendamento enviada à administração."}
        return None
    except Exception as e:
        print(f"Erro ao solicitar reagendamento: {e}")
        return None