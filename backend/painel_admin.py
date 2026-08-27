import os
import json
from datetime import datetime
import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore

# --- CONFIGURAÇÃO DO FIREBASE ---
if not firebase_admin._apps:
    firebase_json = os.environ.get("FIREBASE_CREDENTIALS")
    if firebase_json:
        cred_dict = json.loads(firebase_json)
        if "private_key" in cred_dict:
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    else:
        # Tenta carregar o arquivo JSON local
        try:
            cred = credentials.Certificate("firebase_key.json")
            firebase_admin.initialize_app(cred)
        except Exception as e:
            st.error(f"Erro ao carregar credenciais do Firebase: {e}")

db = firestore.client()

# --- FUNÇÕES AUXILIARES ---
def expandir_horarios_30min(lista_horarios):
    """Garante a expansão correta para blocos de 30 minutos"""
    horarios_expandidos = set()
    for h_str in lista_horarios:
        try:
            # Se o usuário mandar a hora cheia (ex: '8', '14') ou já formatada ('8:00')
            h_limpo = str(h_str).strip().split(":")[0]
            hora = int(h_limpo)
            horarios_expandidos.add(f"{hora}:00")
            horarios_expandidos.add(f"{hora}:30")
        except Exception:
            continue
    return sorted(list(horarios_expandidos), key=lambda x: [int(p) for p in x.split(":")])

def salvar_agenda_admin(data_str, horarios_trabalho):
    horarios_completos = expandir_horarios_30min(horarios_trabalho)
    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    
    if doc.exists:
        dados = doc.to_dict()
        indisponiveis = dados.get("horarios_indisponiveis", [])
        disponiveis = [h for h in horarios_completos if h not in indisponiveis]
        
        doc_ref.set({
            "data": data_str,
            "horarios_de_trabalho": horarios_completos,
            "horarios_disponiveis": disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        }, merge=True)
    else:
        doc_ref.set({
            "data": data_str,
            "horarios_de_trabalho": horarios_completos,
            "horarios_disponiveis": horarios_completos,
            "horarios_indisponiveis": [],
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

# --- INTERFACE DO STREAMLIT ---
st.set_page_config(page_title="Painel Administrativo - Agenda", layout="centered")

st.title("🛠️ Painel Administrativo")
st.write("Gerencie os dias de atendimento e os agendamentos dos clientes.")

aba1, aba2 = st.tabs(["📅 Cadastrar / Gerenciar Agenda", "📋 Aprovar Agendamentos"])

# --- ABA 1: CADASTRAR AGENDA ---
with aba1:
    st.subheader("Configurar Horários de Trabalho do Dia")
    
    data_selecionada = st.date_input("Selecione a Data").strftime("%Y-%m-%d")
    
    # Horários padrões para facilitar a seleção
    horas_padrao = [str(h) for h in range(8, 19)] # Das 8h às 18h
    horarios_escolhidos = st.multiselect(
        "Selecione as horas de atendimento (o sistema quebra automaticamente em 30 min):",
        options=horas_padrao,
        default=["8", "9", "10", "11", "13", "14", "15", "16", "17"]
    )
    
    if st.button("Salvar Agenda no Firebase"):
        if horarios_escolhidos:
            salvar_agenda_admin(data_selecionada, horarios_escolhidos)
            st.success(f"Agenda do dia {data_selecionada} salva e quebrada de 30 em 30 min com sucesso!")
        else:
            st.warning("Selecione pelo menos um horário de trabalho.")

# --- ABA 2: APROVAR / GERENCIAR AGENDAMENTOS ---
with aba2:
    st.subheader("Solicitações de Agendamento")
    
    try:
        # Busca agendamentos de todos os usuários ou coleção raiz (ajuste se sua estrutura usar subcoleções)
        # Como o Firestore pode ter agendamentos por usuários, varremos a raiz ou subcoleções. 
        # Aqui buscamos na coleção raiz 'agendamentos' caso salve direto lá, ou em grupo.
        agendamentos_ref = db.collection_group("agendamentos").stream()
        
        encontrou = False
        for ag in agendamentos_ref:
            encontrou = True
            dados_ag = ag.to_dict()
            ag_id = ag.id
            
            cliente = dados_ag.get("cliente_nome", "Desconhecido")
            telefone = dados_ag.get("cliente_telefone", "N/A")
            servico = dados_ag.get("servico", "Serviço")
            data_ag = dados_ag.get("data_agendamento", "Data não informada")
            horario = dados_ag.get("horario", "Horário não informado")
            status = dados_ag.get("status", "Pendente")
            
            with st.container():
                st.markdown(f"---")
                st.write(f"**Cliente:** {cliente} ({telefone})")
                st.write(f"**Serviço:** {servico} | **Data:** {data_ag} às **{horario}**")
                st.write(f"**Status Atual:** `{status}`")
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    if st.button("✅ Aceitar", key=f"aceitar_{ag_id}"):
                        ag.reference.update({"status": "Confirmado"})
                        st.success("Agendamento aceito!")
                        st.rerun()
                        
                with col2:
                    if st.button("❌ Recusar / Excluir", key=f"recusar_{ag_id}"):
                        # Opcional: Se recusar, você pode devolver o horário para a agenda se quiser
                        ag.reference.delete()
                        st.warning("Agendamento removido!")
                        st.rerun()
        
        if not encontrou:
            st.info("Nenhum agendamento pendente no momento.")
            
    except Exception as e:
        st.info("Nenhum agendamento encontrado ou estrutura em subcoleção aguardando dados.")