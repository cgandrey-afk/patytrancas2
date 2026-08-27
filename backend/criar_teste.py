import os
import json
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Inicializa o Firebase (ele procura o arquivo 'firebase_key.json' na mesma pasta)
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

def criar_agenda_manualmente():
    # Defina a data que você quer testar (formato AAAA-MM-DD)
    data_str = "2026-08-28"
    
    # Horários de trabalho que você deseja abrir (pode mandar horas cheias)
    horarios_trabalho_brutos = ["8", "9", "10", "11", "13", "14", "15", "16", "17"]
    
    # Aplica a mesma lógica de expansão de 30 minutos do seu projeto
    horarios_expandidos = set()
    for h in horarios_trabalho_brutos:
        horarios_expandidos.add(f"{h}:00")
        horarios_expandidos.add(f"{h}:30")
    
    lista_final = sorted(list(horarios_expandidos), key=lambda x: [int(p) for p in x.split(":")])

    # Monta a estrutura exata do JSON que o seu sistema lê
    dados_agenda = {
        "data": data_str,
        "horarios_de_trabalho": lista_final,
        "horarios_disponiveis": lista_final, # Começa todo mundo disponível
        "horarios_indisponiveis": [],
        "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

    # Salva no Firestore usando a data como ID do documento
    db.collection("agenda").document(data_str).set(dados_agenda)
    print(f"Sucesso! A agenda do dia {data_str} foi criada no Firestore com os horários quebrados de 30 em 30 min.")

if __name__ == "__main__":
    criar_agenda_manualmente()