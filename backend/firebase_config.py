import os
import json
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

def salvar_agendamento(user_id, nome, telefone, servico, data_agend, horario):
    try:
        novo_registro = {
            "cliente_nome": nome,
            "cliente_telefone": telefone,
            "servico": servico,
            "data_agendamento": str(data_agend),
            "horario": horario,
            "status": "Pendente",
            "criado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        # Salva na estrutura: usuarios > {user_id} > agendamentos > {id_automatico}
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
    
def carregar_servicos():
    try:
        docs = db.collection("servicos").stream()
        servicos = []
        for doc in docs:
            dados = doc.to_dict()
            # Garante que o nome seja pego do campo 'nome' ou, se não existir, usa o ID do documento ("Box Braids")
            if "nome" not in dados or not dados["nome"]:
                dados["nome"] = doc.id
            
            dados["id"] = doc.id
            servicos.append(dados)
        return servicos
    except Exception as e:
        print(f"Erro ao carregar serviços: {e}")
        return []
    
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
        data_str = dados.get("data")
        horarios = dados.get("horarios_disponiveis", [])
        if horarios:
            agenda[data_str] = horarios
    return agenda

def salvar_agenda(data_str, horarios):
    db.collection("agenda").document(data_str).set({
        "data": data_str,
        "horarios_disponiveis": horarios,
        "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
    })

def remover_horario_agenda(data_str, horario):
    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    if doc.exists:
        horarios = doc.to_dict().get("horarios_disponiveis", [])
        novos_horarios = [h for h in horarios if h != horario]
        if novos_horarios:
            doc_ref.update({"horarios_disponiveis": novos_horarios})
        else:
            doc_ref.delete()

def deletar_agenda(data_str):
    db.collection("agenda").document(data_str).delete()
    
def cancelar_agendamento_db(user_id: str, doc_id: str, status_atual: str):
    try:
        doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        if status_atual == "Pendente":
            # Se for Pendente, deleta fisicamente do banco
            doc_ref.delete()
            return {"acao": "deletado", "mensagem": "Agendamento cancelado e removido."}
        else:
            # Se for Aprovado, marca a flag e define o status_cancelamento como Pendente
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
            # Se for Aprovado, adiciona as flags de reagendamento e o status_reag como Pendente
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