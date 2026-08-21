import streamlit as st
from datetime import datetime
import agendamento
import admin
import utils

# Configuração da página e carregamento do CSS
st.set_page_config(page_title="Paty Tranças", page_icon="👑", layout="wide")
utils.carregar_css()

# 1. TROCA DE ABAS / NAVEGAÇÃO (Substitui 'trocarAba')
with st.sidebar:
    st.markdown("## 👑 Paty Tranças")
    aba_selecionada = st.radio(
        "Menu",
        ["🗓️ Agendar", "📸 Analisar com IA", "📋 Meus Agendamentos", "🔒 Admin"],
        label_visibility="collapsed"
    )

# 2. ABA: AGENDAMENTO (Substitui 'agendar')
if aba_selecionada == "🗓️ Agendar":
    agendamento.render(db=st.session_state.get("db"), salvar_agendamento_fn=st.session_state.get("salvar_fn"))

# 3. ABA: ANALISAR COM IA (Substitui 'analisarFoto' e 'previewFoto')
elif aba_selecionada == "📸 Analisar com IA":
    with st.container(border=True):
        st.subheader("✨ Análise Inteligente de Penteado")
        st.caption("Envie uma foto do estilo desejado para a IA calcular a complexidade.")
        
        # O Streamlit já faz o 'previewFoto' automaticamente no servidor/UI
        foto = st.file_uploader("Selecione a foto do modelo:", type=["jpg", "jpeg", "png"])
        
        if foto is not None:
            col1, col2 = st.columns(2)
            with col1:
                st.image(foto, caption="Preview do Modelo", use_container_width=True)
            
            with col2:
                if st.button("🔍 Analisar com Gemini IA", type="primary", use_container_width=True):
                    with st.spinner("Analisando a imagem... Aguarde alguns segundos."):
                        dados = utils.analisar_imagem_com_gemini(foto)
                    
                    if dados:
                        st.success("✨ Análise Concluída")
                        st.write(f"**Estilo Identificado:** {dados.get('estilo_identificado', 'Não especificado')}")
                        st.write(f"**Dificuldade:** {dados.get('dificuldade', 'Média')}")
                        
                        tempo = utils.formatar_tempo(dados.get('tempo_estimado_minutos', 0))
                        st.write(f"**Tempo Estimado:** {tempo}")
                        st.info(f"**Observação:** {dados.get('observacao', 'Nenhuma observação.')}")

# 4. ABA: LISTA DE AGENDAMENTOS (Substitui 'carregarAgendamentos')
elif aba_selecionada == "📋 Meus Agendamentos":
    st.subheader("📋 Agendamentos Cadastrados")
    
    # Busca do banco em Python (não precisa de fetch para API externa)
    df_agendamentos = st.session_state.get("carregar_agendamentos_fn")()
    
    if not df_agendamentos.empty:
        for _, row in df_agendamentos.iterrows():
            with st.container(border=True):
                col_info, col_data = st.columns([2, 1])
                with col_info:
                    st.markdown(f"**{row['cliente_nome']}** ({row['servico']})")
                    st.caption(f"📱 {row['cliente_telefone']}")
                with col_data:
                    st.markdown(f"📅 {row['data_agendamento']}")
                    st.markdown(f"⏰ {row['horario']}")
    else:
        st.info("Nenhum agendamento encontrado no momento.")

# 5. ABA: ÁREA ADMINISTRATIVA
elif aba_selecionada == "🔒 Admin":
    admin.render(db=st.session_state.get("db"), ...)