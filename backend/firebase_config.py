import os
import json
import threading
import firebase_admin
import re
from firebase_admin import credentials, firestore, messaging
from datetime import datetime, timedelta
import pytz


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

def disparar_notificacao_push(titulo: str, corpo: str):
    try:
        docs = db.collection("configuracoes").document("push_tokens").collection("tokens").stream()
        tokens = [doc.to_dict().get("token") for doc in docs if doc.to_dict().get("token")]

        if not tokens:
            user_docs = db.collection("usuarios").stream()
            for u in user_docs:
                fcm_list = u.to_dict().get("fcm_tokens", [])
                for t in fcm_list:
                    if t and t not in tokens:
                        tokens.append(t)

        if not tokens:
            print("[PUSH] Nenhum token registrado para receber notificações.")
            return

        for token in set(tokens):
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=titulo,
                        body=corpo,
                    ),
                    data={
                        "title": titulo,
                        "body": corpo,
                        "ABRIR_TELA": "agendamentos"
                    },
                    token=token
                )
                messaging.send(message)
                print(f"[PUSH] Notificação enviada para token: {token[:10]}...")
            except Exception as e_tok:
                print(f"[PUSH] Erro ao enviar para token: {e_tok}")
    except Exception as e:
        print(f"[PUSH] Erro ao disparar notificação: {e}")

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
    """Busca a duração exata do serviço com segurança contra textos e números embutidos."""
    print(f"[DEBUG SERVIÇO] Buscando duração para o serviço: '{nome_servico}'")
    try:
        doc = db.collection("servicos").document(nome_servico).get()
        dados = {}
        if doc.exists:
            dados = doc.to_dict()
        else:
            servicos = db.collection("servicos").stream()
            for s in servicos:
                d = s.to_dict()
                if d.get("nome") == nome_servico or s.id == nome_servico:
                    dados = d
                    break

        # Tenta buscar especificamente campos numéricos ou descritivos de tempo
        texto_tempo = dados.get("duracao_horas") or dados.get("tempo_fazer")
        print(f"[DEBUG SERVIÇO] Dados brutos do serviço: {dados} | Tempo identificado: {texto_tempo}")

        if texto_tempo is not None:
            if isinstance(texto_tempo, (int, float)):
                return float(texto_tempo)
            
            texto_str = str(texto_tempo).lower()
            if "30" in texto_str or "meia" in texto_str:
                return 0.5
            
            match_horas_minutos = re.search(r'(\d+):([30]+)', texto_str)
            if match_horas_minutos:
                h = int(match_horas_minutos.group(1))
                m = int(match_horas_minutos.group(2))
                return h + (0.5 if m == 30 else 0.0)

            # Procura apenas se houver menção explícita de horas no texto para evitar pegar números do nome
            match_h = re.search(r'(\d+)\s*(?:h|hora|hr)', texto_str)
            if match_h:
                return float(match_h.group(1))

        print("[DEBUG SERVIÇO] Nenhum tempo válido encontrado, assumindo padrão de 1.0 hora.")
        return 1.0 
    except Exception as e:
        print(f"[DEBUG SERVIÇO] Erro ao buscar duração do serviço: {e}")
        return 1.0

def calcular_blocos_horarios(horario_inicial: str, duracao_horas: float):
    """
    Gera a lista de horários ocupados considerando saltos de 30 em 30 minutos.
    Ex: '8:00' com duração 1.5 -> ['8:00', '8:30', '9:00']
    """
    try:
        partes = horario_inicial.split(":")
        h_inicial = int(partes[0])
        m_inicial = int(partes[1]) if len(partes) > 1 else 0
        
        # Converte o horário inicial total para minutos desde a meia-noite
        total_minutos_inicio = (h_inicial * 60) + m_inicial
        
        # Converte a duração em horas para minutos (ex: 1.5h -> 90 minutos)
        duracao_minutos = int(duracao_horas * 60)
        
        horarios_gerados = []
        # Avança de 30 em 30 minutos até cobrir a duração total do serviço
        minutos_correntes = total_minutos_inicio
        while minutos_correntes < (total_minutos_inicio + duracao_minutos):
            h = minutos_correntes // 60
            m = minutos_correntes % 60
            
            # Formata bonitinho (ex: 8:00 ou 8:30)
            horario_formatado = f"{h}:{m:02d}"
            horarios_gerados.append(horario_formatado)
            
            minutos_correntes += 30
            
        return horarios_gerados
    except Exception as e:
        print(f"Erro ao calcular blocos de horários com quebrados: {e}")
        return [horario_inicial]

def salvar_agendamento(user_id, nome, telefone, servico, data_agend, horario):
    try:
        db.collection("usuarios").document(user_id).set({
            "cliente_nome": nome,
            "cliente_telefone": telefone
        }, merge=True)
        
        # Descobre a duração e calcula todos os blocos ocupados
        duracao = obter_duracao_servico(servico)
        lista_horarios = calcular_blocos_horarios(horario, duracao)

        # Define o nome do documento baseado na janela de horários (Ex: "14:00_16:00")
        if lista_horarios:
            h_inicio = lista_horarios[0]
            # Calcula o término adicionando 30 minutos ao último bloco ou calculando pelo fim do serviço
            # Se a lista tem blocos, o fim do último bloco avança 30 min para fechar a janela exata
            partes_ultimo = lista_horarios[-1].split(":")
            minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
            h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
            nome_doc_horario = f"{h_inicio}_{h_fim}"
        else:
            nome_doc_horario = horario

        novo_registro = {
            "cliente_nome": nome,
            "cliente_telefone": telefone,
            "servico": servico,
            "data_agendamento": str(data_agend),
            "horario": horario,
            "horarios_ocupados": lista_horarios, 
            "status": "Pendente",
            "criado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        
        # 1. Salva no histórico do usuário
        db.collection("usuarios").document(user_id).collection("agendamentos").add(novo_registro)
        
        # 2. Salva o espelho na raiz como agendamentos > DATA > 14:00_16:00
        espelho_raiz = {
            "user_id": user_id,
            "cliente_nome": nome,
            "cliente_telefone": telefone,
            "servico": servico,
            "data_agendamento": str(data_agend),
            "horario": horario,
            "horarios_ocupados": lista_horarios,
            "status": "Pendente",
            "criado_em": novo_registro["criado_em"]
        }
        db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).set(espelho_raiz)

        # Dispara notificação PUSH para o aplicativo do administrador
        disparar_notificacao_push("✨ Novo Agendamento!", f"{nome} agendou {servico} para {data_agend} às {horario}.")

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

def atualizar_status_agendamento(doc_id, novo_status, user_id=None, data_agendamento=None):
    # Mantém compatibilidade caso receba apenas o doc_id original da raiz
    db.collection("agendamentos").document(doc_id).update({"status": novo_status})
    
    # Se receber user_id e data, atualiza também o espelho na raiz e no usuário se necessário
    if user_id and data_agendamento:
        try:
            db.collection("agendamentos").document(str(data_agendamento)).collection("itens").document(user_id).update({"status": novo_status})
        except Exception as e:
            print(f"Erro ao atualizar espelho de status na raiz: {e}")

def deletar_agendamento(doc_id):
    db.collection("agendamentos").document(doc_id).delete()

def expandir_horarios_30min(lista_horarios):
    """
    Recebe uma lista de horários (ex: ['7', '8', '14:00']) e 
    expande automaticamente para incluir os blocos de 30 minutos.
    """
    horarios_expandidos = set()
    
    for h_str in lista_horarios:
        try:
            # Limpa e converte para hora e minuto
            partes = str(h_str).strip().split(":")
            hora = int(partes[0])
            
            # Adiciona a hora cheia e a meia hora correspondente
            horarios_expandidos.add(f"{hora}:00")
            horarios_expandidos.add(f"{hora}:30")
        except Exception:
            continue
            
    # Ordena cronologicamente os horários antes de retornar
    return sorted(list(horarios_expandidos), key=lambda x: [int(p) for p in x.split(":")])

def buscar_agenda_disponivel():
    agenda = {}
    docs = db.collection("agenda").stream()
    
    for doc in docs:
        dados = doc.to_dict()
        data_str = doc.id or dados.get("data")
        
        trabalho = dados.get("horarios_de_trabalho", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        # Expande os horários de trabalho para garantir que os de 30min apareçam
        trabalho_expandido = expandir_horarios_30min(trabalho)
        
        if trabalho_expandido:
            disponiveis_calculados = [h for h in trabalho_expandido if h not in indisponiveis]
        else:
            disponiveis_calculados = dados.get("horarios_disponiveis", [])

        if data_str and disponiveis_calculados:
            agenda[data_str] = disponiveis_calculados
            
    return agenda

def salvar_agenda(data_str, horarios_trabalho):
    """
    Cadastra/Atualiza a agenda do dia. 
    Expande e já grava os disponíveis totalmente quebrados e ordenados de 30 em 30 minutos.
    """
    horarios_completos = expandir_horarios_30min(horarios_trabalho)
    # Garante a ordenação correta logo na origem
    horarios_completos.sort(key=lambda x: [int(p) for p in x.split(":")])

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    
    if doc.exists:
        dados = doc.to_dict()
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        disponiveis = [h for h in horarios_completos if h not in indisponiveis]
        disponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
        
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

def verificar_e_aplicar_corte_10min(data_str: str):
    fuso_br = pytz.timezone("America/Sao_Paulo")
    agora = datetime.now(fuso_br)
    hoje_str = agora.strftime("%Y-%m-%d")
    
    print(f"[DEBUG 10MIN] Data consultada: {data_str} | Hoje (Servidor BR): {hoje_str} | Hora atual: {agora.strftime('%H:%M:%S')}")
    
    if data_str != hoje_str:
        print("[DEBUG 10MIN] A data consultada não é hoje. Ignorando corte.")
        return

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    if not doc.exists:
        print(f"[DEBUG 10MIN] Documento da data {data_str} não encontrado no Firestore.")
        return
        
    dados = doc.to_dict()
    disponiveis = dados.get("horarios_disponiveis", [])
    indisponiveis = dados.get("horarios_indisponiveis", [])
    
    print(f"[DEBUG 10MIN] Horários disponíveis antes do corte: {disponiveis}")
    
    houve_alteracao = False
    novos_disponiveis = []
    
    for h in disponiveis:
        try:
            hora_slot, min_slot = map(int, h.split(":"))
            dt_slot = agora.replace(hour=hora_slot, minute=min_slot, second=0, microsecond=0)
            
            diferenca = dt_slot - agora
            minutos_restantes = diferenca.total_seconds() / 60
            
            print(f"[DEBUG 10MIN] Slot {h} -> Faltam {minutos_restantes:.1f} minutos (dt_slot: {dt_slot} vs agora: {agora})")
            
            # Se falta menos de 10 minutos ou já passou
            if dt_slot < (agora + timedelta(minutes=10)):
                print(f"[DEBUG 10MIN] -> BLOQUEANDO slot {h} (Passou do limite de 10 min)")
                if h not in indisponiveis:
                    indisponiveis.append(h)
                houve_alteracao = True
            else:
                novos_disponiveis.append(h)
        except Exception as e:
            print(f"[DEBUG 10MIN] Erro ao processar o slot {h}: {e}")
            novos_disponiveis.append(h)
            
    if houve_alteracao:
        novos_disponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
        indisponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
        
        doc_ref.update({
            "horarios_disponiveis": novos_disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })
        print("[DEBUG 10MIN] Banco atualizado com sucesso com os horários bloqueados.")
    else:
        print("[DEBUG 10MIN] Nenhum horário atingiu o limite de corte nesta execução.")

def mover_horario_para_indisponivel(data_str, horario_inicial, servico):
    """Move todos os blocos de horários (incluindo os de 30min) para indisponíveis"""
    duracao = obter_duracao_servico(servico)
    horarios_a_bloquear = calcular_blocos_horarios(horario_inicial, duracao)

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    
    fuso_br = pytz.timezone("America/Sao_Paulo")
    agora = datetime.now(fuso_br)
    data_hoje = agora.strftime("%Y-%m-%d")

    if doc.exists:
        dados = doc.to_dict()
        disponiveis = dados.get("horarios_disponiveis", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        
        # 1. Bloqueia os horários vindos do agendamento do serviço
        for h in horarios_a_bloquear:
            if h in disponiveis:
                disponiveis.remove(h)
            if h not in indisponiveis:
                indisponiveis.append(h)
                
        # 2. Regra automática de 10 minutos de antecedência para o dia de hoje
        if data_str == data_hoje:
            novos_disponiveis = []
            for h in disponiveis:
                hora_slot, min_slot = map(int, h.split(":"))
                dt_slot = agora.replace(hour=hora_slot, minute=min_slot, second=0, microsecond=0)
                
                # Se faltar menos de 10 minutos ou já passou, joga para indisponível
                if dt_slot < (agora + timedelta(minutes=10)):
                    if h not in indisponiveis:
                        indisponiveis.append(h)
                else:
                    novos_disponiveis.append(h)
            disponiveis = novos_disponiveis

        disponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
        indisponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
            
        doc_ref.update({
            "horarios_disponiveis": disponiveis,
            "horarios_indisponiveis": indisponiveis,
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

def voltar_horario_para_disponivel(data_str, horario_inicial, servico):
    duracao = obter_duracao_servico(servico)
    horarios_a_liberar = calcular_blocos_horarios(horario_inicial, duracao)

    print(f"[DEBUG CANCELAR] Tentando liberar horários {horarios_a_liberar} para a data {data_str} (Serviço: {servico})")

    doc_ref = db.collection("agenda").document(data_str)
    doc = doc_ref.get()
    if not doc.exists:
        print("[DEBUG CANCELAR] Documento da agenda não existe.")
        return

    dados = doc.to_dict()
    disponiveis = dados.get("horarios_disponiveis", [])
    indisponiveis = dados.get("horarios_indisponiveis", [])
    trabalho = dados.get("horarios_de_trabalho", [])
    
    fuso_br = pytz.timezone("America/Sao_Paulo")
    agora = datetime.now(fuso_br)
    hoje_str = agora.strftime("%Y-%m-%d")

    for h in horarios_a_liberar:
        if h in indisponiveis:
            indisponiveis.remove(h)
            
        if data_str == hoje_str:
            try:
                hora_slot, min_slot = map(int, h.split(":"))
                dt_slot = agora.replace(hour=hora_slot, minute=min_slot, second=0, microsecond=0)
                
                diferenca = dt_slot - agora
                minutos_restantes = diferenca.total_seconds() / 60
                
                print(f"[DEBUG CANCELAR] Analisando slot liberado {h} -> Faltam {minutos_restantes:.1f} minutos")
                
                # Se já passou ou falta menos de 10 min, mantém bloqueado
                if dt_slot < (agora + timedelta(minutes=10)):
                    print(f"[DEBUG CANCELAR] -> MANTENDO BLOQUEADO o slot {h} (Já passou ou menos de 10 min)")
                    if h not in indisponiveis:
                        indisponiveis.append(h)
                    continue
            except Exception as e:
                print(f"[DEBUG CANCELAR] Erro ao validar tempo do slot {h}: {e}")
                
        # Devolve para disponível se passar na regra
        if h not in disponiveis and h in trabalho:
            print(f"[DEBUG CANCELAR] -> DEVOLVENDO PARA DISPONÍVEL o slot {h}")
            disponiveis.append(h)
            
    disponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
    indisponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
        
    doc_ref.update({
        "horarios_disponiveis": disponiveis,
        "horarios_indisponiveis": indisponiveis,
        "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
    })
    print("[DEBUG CANCELAR] Atualização de cancelamento concluída no DB.")

def deletar_agenda(data_str):
    db.collection("agenda").document(data_str).delete()

# --- MONITORAMENTO EM TEMPO REAL (BLINDADO CONTRA LOOP) ---
def processar_atualizacao_automatica(doc_ref, dados):
    try:
        trabalho = dados.get("horarios_de_trabalho", [])
        indisponiveis = dados.get("horarios_indisponiveis", [])
        disponiveis_atuais = dados.get("horarios_disponiveis", [])
        
        if not trabalho:
            return

        # Expande e ordena tudo rigorosamente
        trabalho_expandido = expandir_horarios_30min(trabalho)
        trabalho_expandido.sort(key=lambda x: [int(p) for p in x.split(":")])
        
        disponiveis_calculados = [h for h in trabalho_expandido if h not in indisponiveis]
        disponiveis_calculados.sort(key=lambda x: [int(p) for p in x.split(":")])
        disponiveis_atuais.sort(key=lambda x: [int(p) for p in x.split(":")])

        # Só dispara o update se houver real divergência para evitar loop infinito
        if disponiveis_atuais != disponiveis_calculados or trabalho != trabalho_expandido:
            doc_ref.update({
                "horarios_de_trabalho": trabalho_expandido,
                "horarios_disponiveis": disponiveis_calculados,
                "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
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
        lista_horarios = []
        if doc_dados.exists:
            d = doc_dados.to_dict()
            data_agend = d.get("data_agendamento")
            horario = d.get("horario")
            servico = d.get("servico")
            lista_horarios = d.get("horarios_ocupados", [])

        if status_atual == "Pendente":
            fuso_br = pytz.timezone("America/Sao_Paulo")
            agora_str = datetime.now(fuso_br).strftime("%Y-%m-%d %H:%M:%S")
            
            # Atualiza para cancelado mantendo no histórico do cliente
            doc_ref.update({
                "status": "Cancelado",
                "status_cancelamento": "Aprovado",
                "cancelado_em": agora_str
            })
            
            # DELETA o espelho da raiz usando o formato de janela de horário como ID do documento
            if data_agend and lista_horarios:
                try:
                    h_inicio = lista_horarios[0]
                    partes_ultimo = lista_horarios[-1].split(":")
                    minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
                    h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
                    nome_doc_horario = f"{h_inicio}_{h_fim}"

                    db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).delete()
                except Exception as ex:
                    print(f"Erro ao remover espelho da raiz no cancelamento: {ex}")
            
            # Devolve o horário para a agenda pública
            if data_agend and horario and servico:
                voltar_horario_para_disponivel(data_agend, horario, servico)
                
            return {"acao": "cancelado", "mensagem": "Agendamento cancelado com sucesso."}
        else:
            update_data = {
                "pedido_cancelamento": True,
                "status_cancelamento": "Pendente"
            }
            doc_ref.update(update_data)

            # Atualiza também o documento espelho na coleção raiz 'agendamentos' para o app Android identificar
            if data_agend and lista_horarios:
                try:
                    h_inicio = lista_horarios[0]
                    partes_ultimo = lista_horarios[-1].split(":")
                    minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
                    h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
                    nome_doc_horario = f"{h_inicio}_{h_fim}"

                    db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).update(update_data)
                except Exception as ex:
                    print(f"Erro ao atualizar espelho raiz no pedido de cancelamento: {ex}")

            disparar_notificacao_push("❌ Pedido de Cancelamento", f"O cliente {d.get('cliente_nome', 'Cliente')} solicitou cancelamento para o dia {data_agend} às {horario}.")

            return {"acao": "solicitado", "mensagem": "Solicitação de cancelamento enviada à administração."}
            
    except Exception as e:
        print(f"Erro ao cancelar agendamento: {e}")
        return None

def solicitar_reagendamento_db(user_id: str, doc_id: str, status_atual: str, nova_data: str, novo_horario: str):
    try:
        doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        doc_dados = doc_ref.get()

        data_agend = None
        servico = None
        lista_horarios = []
        if doc_dados.exists:
            d = doc_dados.to_dict()
            data_agend = d.get("data_agendamento")
            servico = d.get("servico")
            lista_horarios = d.get("horarios_ocupados", [])

        if status_atual in ["Aprovado", "Confirmado"]:
            # 1. Calcula a lista de novos horários e já bloqueia na nova data na agenda pública
            novos_horarios_ocupados = []
            if servico and nova_data and novo_horario:
                duracao = obter_duracao_servico(servico)
                novos_horarios_ocupados = calcular_blocos_horarios(novo_horario, duracao)
                mover_horario_para_indisponivel(nova_data, novo_horario, servico)

            update_data = {
                "pedido_reagendamento": True,
                "status_reag": "Pendente",
                "novo_data": nova_data,
                "novo_horario": novo_horario,
                "novos_horarios_ocupados": novos_horarios_ocupados
            }
            doc_ref.update(update_data)

            if data_agend and lista_horarios:
                try:
                    h_inicio = lista_horarios[0]
                    partes_ultimo = lista_horarios[-1].split(":")
                    minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
                    h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
                    nome_doc_horario = f"{h_inicio}_{h_fim}"

                    db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).update(update_data)
                except Exception as ex:
                    print(f"Erro ao atualizar espelho raiz no pedido de reagendamento: {ex}")

            disparar_notificacao_push("🔄 Pedido de Reagendamento", f"O cliente {d.get('cliente_nome', 'Cliente')} solicitou reagendamento para o dia {nova_data} às {novo_horario}.")

            return {"acao": "solicitado", "mensagem": "Solicitação de reagendamento enviada à administração."}
        return None
    except Exception as e:
        print(f"Erro ao solicitar reagendamento: {e}")
        return None

def desistir_solicitacao_db(user_id: str, doc_id: str):
    try:
        user_doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        doc_dados = user_doc_ref.get()
        if not doc_dados.exists:
            return False

        d = doc_dados.to_dict()
        data_agend = d.get("data_agendamento")
        lista_horarios = d.get("horarios_ocupados", [])
        novo_data = d.get("novo_data")
        novos_horarios_ocupados = d.get("novos_horarios_ocupados", [])

        # Se havia reserva na nova data pelo pedido de reagendamento, devolve para disponível na agenda pública
        if novo_data and novos_horarios_ocupados:
            try:
                agenda_nova_ref = db.collection("agenda").document(novo_data)
                doc_agenda = agenda_nova_ref.get()
                if doc_agenda.exists:
                    indisponiveis = doc_agenda.to_dict().get("horarios_indisponiveis", [])
                    disponiveis = doc_agenda.to_dict().get("horarios_disponiveis", [])
                    for h in novos_horarios_ocupados:
                        if h in indisponiveis:
                            indisponiveis.remove(h)
                        if h not in disponiveis:
                            disponiveis.append(h)
                    disponiveis.sort(key=lambda x: [int(p) for p in x.split(":")])
                    agenda_nova_ref.update({
                        "horarios_disponiveis": disponiveis,
                        "horarios_indisponiveis": indisponiveis,
                        "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M")
                    })
            except Exception as ex:
                print(f"Erro ao liberar novos horários ao desistir de reagendamento: {ex}")

        reset_data = {
            "pedido_cancelamento": False,
            "status_cancelamento": "",
            "pedido_reagendamento": False,
            "status_reag": "",
            "novo_data": "",
            "novo_horario": "",
            "novos_horarios_ocupados": []
        }

        # Atualiza documento do usuário
        user_doc_ref.update(reset_data)

        # Atualiza documento espelho na raiz
        if data_agend and lista_horarios:
            try:
                h_inicio = lista_horarios[0]
                partes_ultimo = lista_horarios[-1].split(":")
                minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
                h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
                nome_doc_horario = f"{h_inicio}_{h_fim}"

                db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).update(reset_data)
            except Exception as ex:
                print(f"Erro ao atualizar espelho raiz na desistência de solicitação: {ex}")

        return True
    except Exception as e:
        print(f"Erro ao desistir da solicitação: {e}")
        return False

def salvar_avaliacao_db(user_id: str, doc_id: str, stars_tpexc: int, stars_tranca: int, sugestao_serv: str):
    try:
        user_doc_ref = db.collection("usuarios").document(user_id).collection("agendamentos").document(doc_id)
        doc_dados = user_doc_ref.get()
        if not doc_dados.exists:
            return False

        d = doc_dados.to_dict()
        data_agend = d.get("data_agendamento")
        lista_horarios = d.get("horarios_ocupados", [])

        avaliacao_data = {
            "stars_tpexc": stars_tpexc,
            "stars_tranca": stars_tranca,
            "sugestao_serv": sugestao_serv,
            "avaliacao_feita": True,
            "avaliado_em": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        # 1. Salva na pasta do usuário
        user_doc_ref.update(avaliacao_data)

        # 2. Salva no espelho na raiz agendamentos/{data}/horarios/{nome_doc_horario}
        if data_agend and lista_horarios:
            try:
                h_inicio = lista_horarios[0]
                partes_ultimo = lista_horarios[-1].split(":")
                minutos_totais_fim = int(partes_ultimo[0]) * 60 + int(partes_ultimo[1]) + 30
                h_fim = f"{minutos_totais_fim // 60}:{minutos_totais_fim % 60:02d}"
                nome_doc_horario = f"{h_inicio}_{h_fim}"

                db.collection("agendamentos").document(str(data_agend)).collection("horarios").document(nome_doc_horario).update(avaliacao_data)
            except Exception as ex:
                print(f"Erro ao salvar avaliação no espelho raiz: {ex}")

        return True
    except Exception as e:
        print(f"Erro ao salvar avaliação: {e}")
        return False

def filtrar_horarios_iniciais_sequenciais(horarios_disponiveis: list, duracao_horas: float):
    print(f"[DEBUG FILTRO] Horários disponíveis recebidos: {horarios_disponiveis} | Duração necessária (horas): {duracao_horas}")
    if not horarios_disponiveis:
        print("[DEBUG FILTRO] Lista de horários disponíveis vazia!")
        return []
        
    slots_validos = []
    
    # Converte os horários disponíveis em minutos desde a meia-noite para facilitar a checagem matemática de sequência contínua
    def para_minutos(h_str):
        p = h_str.split(":")
        return int(p[0]) * 60 + int(p[1])
    
    # Cria um set para busca rápida O(1)
    set_disponiveis = set(horarios_disponiveis)
    
    for i in range(len(horarios_disponiveis)):
        horario_inicio = horarios_disponiveis[i]
        blocos_necessarios = calcular_blocos_horarios(horario_inicio, duracao_horas)
        
        # Validação ultra-robusta: verifica se cada bloco existe e se a sequência é consecutiva de 30 em 30 min exatos
        todos_presentes = True
        minuto_anterior = None
        
        for b in blocos_necessarios:
            if b not in set_disponiveis:
                todos_presentes = False
                break
            min_atual = para_minutos(b)
            if minuto_anterior is not None and min_atual - minuto_anterior != 30:
                todos_presentes = False
                break
            minuto_anterior = min_atual

        print(f"[DEBUG FILTRO] Início: {horario_inicio} exige os blocos {blocos_necessarios} -> Todos presentes e sequenciais? {todos_presentes}")
        
        if todos_presentes:
            slots_validos.append(horario_inicio)
            
    print(f"[DEBUG FILTRO] Slots finais válidos: {slots_validos}")
    return slots_validos

def tem_espaco_consecutivo(horarios_disponiveis: list, duracao_horas: float):
    resultado = len(filtrar_horarios_iniciais_sequenciais(horarios_disponiveis, duracao_horas)) > 0
    return resultado

def buscar_avaliacoes_publicas():
    try:
        docs = db.collection_group("horarios").stream()
        comentarios_aprovados = []
        todas_estrelas_tranca = []
        todas_estrelas_tpexc = []

        for doc in docs:
            d = doc.to_dict()
            st_tranca = d.get("stars_tranca", 0)
            st_tpexc = d.get("stars_tpexc", 0)
            sugestao = d.get("sugestao_serv", "")
            publicado = d.get("publicado", False) or d.get("aprovado", False)

            if st_tranca > 0:
                todas_estrelas_tranca.append(st_tranca)
            if st_tpexc > 0:
                todas_estrelas_tpexc.append(st_tpexc)

            if publicado and sugestao and sugestao.strip():
                comentarios_aprovados.append({
                    "cliente_nome": d.get("cliente_nome", "Cliente"),
                    "servico": d.get("servico", "Trança"),
                    "stars_tranca": st_tranca,
                    "stars_tpexc": st_tpexc,
                    "comentario": sugestao,
                    "data": d.get("data_agendamento", "")
                })

        media_tranca = round(sum(todas_estrelas_tranca) / len(todas_estrelas_tranca), 1) if todas_estrelas_tranca else 5.0
        media_tpexc = round(sum(todas_estrelas_tpexc) / len(todas_estrelas_tpexc), 1) if todas_estrelas_tpexc else 5.0
        total_avaliacoes = max(len(todas_estrelas_tranca), len(todas_estrelas_tpexc))

        return {
            "media_tranca": media_tranca,
            "media_tpexc": media_tpexc,
            "total_avaliacoes": total_avaliacoes,
            "comentarios": comentarios_aprovados
        }
    except Exception as e:
        print(f"Erro ao buscar avaliações públicas: {e}")
        return {
            "media_tranca": 5.0,
            "media_tpexc": 5.0,
            "total_avaliacoes": 0,
            "comentarios": []
        }

def obter_favoritos_db(user_id: str):
    try:
        doc = db.collection("usuarios").document(user_id).get()
        if doc.exists:
            favs = doc.to_dict().get("favoritos", [])
            return favs if isinstance(favs, list) else []
        return []
    except Exception as e:
        print(f"Erro ao obter favoritos do usuário: {e}")
        return []

def toggle_favorito_db(user_id: str, servico_nome: str):
    try:
        doc_ref = db.collection("usuarios").document(user_id)
        doc = doc_ref.get()
        favoritos = []
        if doc.exists:
            raw = doc.to_dict().get("favoritos", [])
            if isinstance(raw, list):
                favoritos = raw

        if servico_nome in favoritos:
            favoritos.remove(servico_nome)
        else:
            favoritos.append(servico_nome)

        doc_ref.set({"favoritos": favoritos}, merge=True)
        return favoritos
    except Exception as e:
        print(f"Erro ao alternar favorito: {e}")
        return []

def obter_usuario_db(user_id: str):
    try:
        doc = db.collection("usuarios").document(user_id).get()
        if doc.exists:
            d = doc.to_dict()
            return {
                "cliente_nome": d.get("cliente_nome", ""),
                "cliente_telefone": d.get("cliente_telefone", "")
            }
        return {"cliente_nome": "", "cliente_telefone": ""}
    except Exception as e:
        print(f"Erro ao obter dados do usuário: {e}")
        return {"cliente_nome": "", "cliente_telefone": ""}

def gerar_descricoes_locais(nome: str, categoria: str = "", tempo: str = "", durabilidade: str = ""):
    nome_clean = nome.strip()
    cat_str = f" ({categoria})" if categoria else ""
    tempo_str = f" executado em aproximadamente {tempo}" if tempo else ""
    dura_str = f" com durabilidade média de {durabilidade}" if durabilidade else ""

    curta = f"Modelo {nome_clean}: visual elegante, versátil e marcante que valoriza sua beleza natural."

    longa = f"""O modelo {nome_clean}{cat_str} é ideal para quem busca alinhar elegância, praticidade e um visual cheio de personalidade.

Feito com técnicas exclusivas e acabamento de alta qualidade{tempo_str}, este estilo garante leveza e proteção aos fios naturais{dura_str}.

Perfeito para qualquer ocasião, do dia a dia a eventos especiais. Dica de cuidado: durma com touca ou fronha de cetim para manter suas tranças sempre lindas e alinhadas!"""

    return curta, longa