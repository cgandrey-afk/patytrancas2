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

def carregar_agendamentos():
    docs = db.collection("agendamentos").stream()
    lista = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        lista.append(d)
    return lista

def salvar_agendamento(nome, telefone, servico, data_agend, horario):
    novo_registro = {
        "cliente_nome": nome,
        "cliente_telefone": telefone,
        "servico": servico,
        "data_agendamento": str(data_agend),
        "horario": horario,
        "status": "Pendente",
        "criado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    db.collection("agendamentos").add(novo_registro)
    return True

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