import os
import json
import threading
import firebase_admin
import re
from firebase_admin import credentials, firestore
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