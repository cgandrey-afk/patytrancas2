const API_URL = "https://patytrancas2.onrender.com";

// Obtém ou cria um ID de usuário único e permanente para este navegador/aparelho
function obterUserIdUnico() {
  let userId = localStorage.getItem('paty_trancas_user_id');
  if (!userId) {
    // Gera um UUID v4 simples via JavaScript
    userId = 'user_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('paty_trancas_user_id', userId);
  }
  return userId;
}

const MEU_USER_ID = obterUserIdUnico();


// Alterna a exibição do menu estilo pílula no celular
function toggleMenuMobile() {
  const menu = document.getElementById('navMenu');
  if (menu) {
    menu.classList.toggle('open');
  }
}

// Fecha a caixa do menu mobile ao clicar em qualquer item
function fecharMenuMobile() {
  const menu = document.getElementById('navMenu');
  if (menu) {
    menu.classList.remove('open');
  }
}

// Busca a logo dinâmica no servidor
async function carregarLogo() {
  try {
    const res = await fetch(`${API_URL}/api/logo`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ativo !== false && data.logo_url) {
        const container = document.getElementById('brandLogoContainer');
        const textSpan = document.getElementById('brandLogoText');
        
        if (container) {
          // Oculta o texto padrão
          if (textSpan) textSpan.style.display = 'none';
          
          // Adiciona/Atualiza a imagem da logo
          let imgElement = container.querySelector('.brand-logo-img');
          if (!imgElement) {
            imgElement = document.createElement('img');
            imgElement.className = 'brand-logo-img';
            imgElement.alt = 'Paty Tranças';
            container.appendChild(imgElement);
          }
          imgElement.src = data.logo_url;
        }
      }
    }
  } catch (err) {
    console.error("Erro ao carregar logo:", err);
  }
}

// Busca os banners dinâmicos no servidor
async function carregarBanners() {
  try {
    const res = await fetch(`${API_URL}/api/banners`);
    if (res.ok) {
      const data = await res.json();
      
      if (data && data.ativo !== false) {
        const desktopImg = document.getElementById('bannerDesktopImg');
        const mobileSource = document.getElementById('bannerMobileSource');
        const bannerLink = document.getElementById('bannerLink');

        if (desktopImg && data.desktop_url) desktopImg.src = data.desktop_url;
        if (mobileSource && data.mobile_url) mobileSource.srcset = data.mobile_url;
        if (bannerLink && data.link) bannerLink.href = data.link;
      }
    }
  } catch (err) {
    console.error("Erro ao carregar banners:", err);
  }
}

let listaServicosGlobal = [];

// Busca serviços no banco e preenche a tela + o select do formulário
async function carregarServicos() {
  const container = document.getElementById('gridServicos');
  const selectServico = document.getElementById('servico');

  try {
    const res = await fetch(`${API_URL}/api/servicos`);
    if (res.ok) {
      listaServicosGlobal = await res.json();
      
      // Monta os cards na tela com os rótulos atualizados
      if (container) {
        container.innerHTML = listaServicosGlobal.map((item, index) => `
          <div class="card-servico" onclick="abrirModalServico(${index})">
            <h3>${item.nome}</h3>
            <img src="${item.foto_url}" alt="${item.nome}" class="card-servico-img">
            <p>${item.descricao_curta}</p>
            
            <div class="info-rapida-servico">
              <span>⏱️ <strong>Execução:</strong> ${item.tempo_fazer || 'Sob consulta'}</span><br>
              <span>⏳ <strong>Duração:</strong> ${item.durabilidade || 'Sob consulta'}</span>
            </div>

            <span class="price-tag">${item.preco}</span>
          </div>
        `).join('');
      }

      // Preenche o campo de seleção do formulário de agendamento
      if (selectServico && listaServicosGlobal.length > 0) {
        selectServico.innerHTML = listaServicosGlobal.map(item => `
          <option value="${item.nome}">${item.nome} (${item.preco})</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error("Erro ao carregar serviços:", err);
  }
}

function abrirModalServico(index) {
  const item = listaServicosGlobal[index];
  if (!item) return;

  document.getElementById('modalNome').innerText = item.nome;
  document.getElementById('modalFoto').src = item.foto_url;
  document.getElementById('modalPreco').innerText = item.preco;
  
  // Exibe a descrição detalhada com o novo rótulo
  document.getElementById('modalDescricaoLonga').innerHTML = `
    ${item.descricao_longa || item.descricao_curta}<br><br>
    <strong>⏱️ Tempo de Execução:</strong> ${item.tempo_fazer || 'Sob consulta'}<br>
    <strong>⏳ Durabilidade no Cabelo:</strong> ${item.durabilidade || 'Sob consulta'}<br><br>
    <small style="color: var(--text-muted); display: block; line-height: 1.3;">
      ⚠️ <strong>Aviso:</strong> A durabilidade informada é uma estimativa. A conservação do penteado depende diretamente dos cuidados diários (uso de touca de cetim, manutenção do couro cabeludo seco e higienização adequada).
    </small>
  `;
  
  // Seleciona automaticamente esse serviço no formulário
  const selectServico = document.getElementById('servico');
  if (selectServico) selectServico.value = item.nome;

  document.getElementById('modalServico').style.display = 'flex';
}

function fecharModalServico(e, forcar = false) {
  if (forcar || (e && e.target.id === 'modalServico')) {
    document.getElementById('modalServico').style.display = 'none';
  }
}

function previewFoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('imgPreview').src = e.target.result;
      document.getElementById('previewContainer').style.display = 'block';
    }
    reader.readAsDataURL(file);
  }
}

async function analisarFoto() {
  const fileInput = document.getElementById('fotoInput');
  const divResultado = document.getElementById('resultadoIA');

  if (!fileInput.files[0]) {
    alert("Selecione uma foto do modelo primeiro!");
    return;
  }

  divResultado.style.display = 'block';
  divResultado.innerHTML = "⏳ <em>Analisando imagem com o Gemini IA... Aguarde alguns segundos.</em>";

  const formData = new FormData();
  formData.append("foto", fileInput.files[0]);

  try {
    const res = await fetch(`${API_URL}/api/analisar-ia`, { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      divResultado.innerHTML = `
        <h3 style="color:#c25975; margin-bottom:10px;">✨ Análise Concluída</h3>
        <p><strong>Estilo Identificado:</strong> ${data.estilo_identificado || 'Não especificado'}</p>
        <p><strong>Dificuldade:</strong> ${data.dificuldade || 'Média'}</p>
        <p><strong>Tempo Estimado:</strong> ${data.tempo_estimado_minutos || '--'} minutos</p>
        <p style="margin-top:8px;"><strong>Observação:</strong> ${data.observacao || 'Nenhuma observação.'}</p>
      `;
    } else {
      divResultado.innerHTML = "<p style='color:#ef4444;'>❌ Ocorreu um erro ao processar a imagem no servidor.</p>";
    }
  } catch (err) {
    divResultado.innerHTML = "<p style='color:#ef4444;'>❌ Erro ao conectar com o serviço de IA.</p>";
  }
}

async function agendar(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('mensagemStatus');
  statusDiv.innerHTML = "Salvando agendamento...";

  const payload = {
    user_id: MEU_USER_ID, 
    cliente_nome: document.getElementById('nome').value,
    cliente_telefone: document.getElementById('telefone').value,
    servico: document.getElementById('servico').value,
    data_agendamento: document.getElementById('data').value,
    horario: document.getElementById('horario').value
  };

  try {
    const res = await fetch(`${API_URL}/api/agendamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      statusDiv.innerHTML = "<p style='color:#22c55e;'>✅ Agendamento realizado com sucesso!</p>";
      document.getElementById('formAgendamento').reset();
      limparHorarios(); 
      carregarAgendamentos(); 

      // Faz a mensagem de sucesso sumir após 5 segundos garantindo a limpeza
      setTimeout(() => {
        const divAtualizada = document.getElementById('mensagemStatus');
        if (divAtualizada) {
          divAtualizada.innerHTML = "";
        }
      }, 5000);

    } else {
      statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Não foi possível realizar o agendamento.</p>";
    }
  } catch (err) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Erro de conexão com o servidor.</p>";
  }
}

async function carregarAgendamentos() {
  const container = document.getElementById('listaAgendamentos');
  if (!container) return;
  
  container.innerHTML = "Buscando agendamentos...";

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${MEU_USER_ID}`);
    const agendamentos = await res.json();

    if (res.ok && Array.isArray(agendamentos) && agendamentos.length > 0) {
      container.innerHTML = agendamentos.map(item => {
        let corStatus = "#eab308"; 
        if (item.status === "Aprovado") corStatus = "#22c55e"; 
        if (item.status === "Cancelado") corStatus = "#ef4444"; 

        return `
          <div class="agendamento-card" style="border-left: 4px solid ${corStatus}; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong>${item.cliente_nome}</strong> (${item.servico})<br>
                <small style="color:var(--text-muted)">📱 ${item.cliente_telefone}</small><br>
                <small>Status: <strong style="color: ${corStatus}">${item.status || 'Pendente, aguardando aprovação'}</strong></small>
                ${item.pedido_cancelamento ? '<br><small style="color:#ef4444">⚠️ Cancelamento solicitado (Pendente)</small>' : ''}
                ${item.pedido_reagendamento ? '<br><small style="color:#3b82f6">⚠️ Reagendamento solicitado para ' + item.novo_data + ' às ' + item.novo_horario + ' (Status: ' + (item.status_reag || 'Pendente') + ')</small>' : ''}
              </div>
              <div style="text-align:right;">
                📅 ${item.data_agendamento}<br>
                ⏰ ${item.horario}
              </div>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end;">
              <button onclick='prepararReagendamento("${item.id}", "${item.status}", "${item.cliente_nome}", "${item.cliente_telefone}", "${item.servico}")' style="padding: 6px 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">
                🔄 Reagendar
              </button>
              <button onclick='executarCancelamento("${item.id}", "${item.status}")' style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">
                ❌ Cancelar
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = "<p style='color:var(--text-muted);'>Nenhum agendamento encontrado para este aparelho.</p>";
    }
  } catch (err) {
    container.innerHTML = "<p style='color:#ef4444;'>Erro ao carregar os agendamentos.</p>";
  }
}

// =============================================================
// EFEITO DE OCULTAR BOTÕES SOCIAIS POR INATIVIDADE (IDLE)
// =============================================================
let tempoInatividade;
const TEMPO_PARA_ESCONDER = 3500; 

function resetarTemporizadorInatividade() {
  const container = document.querySelector('.social-float-container');
  if (!container) return;

  container.classList.remove('hidden-idle');
  clearTimeout(tempoInatividade);

  tempoInatividade = setTimeout(() => {
    container.classList.add('hidden-idle');
  }, TEMPO_PARA_ESCONDER);
}

['mousemove', 'mousedown', 'touchstart', 'scroll', 'keydown'].forEach(evento => {
  window.addEventListener(evento, resetarTemporizadorInatividade, { passive: true });
});

async function executarCancelamento(docId, statusAtual) {
  if (!confirm("Deseja realmente cancelar este agendamento?")) return;

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/cancelar/${MEU_USER_ID}/${docId}?status=${statusAtual}`, {
      method: "DELETE"
    });
    
    if (res.ok) {
      const data = await res.json();
      alert(data.mensagem);
      carregarAgendamentos(); 
    } else {
      alert("Erro ao processar o cancelamento.");
    }
  } catch (err) {
    console.error("Erro:", err);
    alert("Erro de conexão com o servidor.");
  }
}

function prepararReagendamento(docId, statusAtual, nome, telefone, servico) {
  if (statusAtual === "Pendente") {
    document.getElementById('nome').value = nome;
    document.getElementById('telefone').value = telefone;
    document.getElementById('servico').value = servico;
    document.getElementById('data').value = "";
    limparHorarios();

    executarCancelamento(docId, "Pendente");
    document.getElementById('formAgendamento').scrollIntoView({ behavior: 'smooth' });
    alert("Dados carregados no formulário! Escolha a nova data e horário e clique em agendar.");

  } else if (statusAtual === "Aprovado") {
    const novaData = prompt("Digite a nova data desejada (AAAA-MM-DD):");
    const novoHorario = prompt("Digite o novo horário desejado (HH:MM):");

    if (!novaData || !novoHorario) return;

    enviarSolicitacaoReagendamentoAprovado(docId, statusAtual, novaData, novoHorario);
  }
}

async function enviarSolicitacaoReagendamentoAprovado(docId, statusAtual, novaData, novoHorario) {
  const payload = {
    user_id: MEU_USER_ID,
    doc_id: docId,
    status_atual: statusAtual,
    nova_data: novaData,
    novo_horario: novoHorario
  };

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/reagendar-aprovado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.mensagem);
      carregarAgendamentos();
    } else {
      alert("Erro ao solicitar reagendamento.");
    }
  } catch (err) {
    console.error("Erro:", err);
    alert("Erro de conexão com o servidor.");
  }
}

let telefoneWhatsAppGlobal = '';
let instagramUrlGlobal = '';
let enderecoGlobal = '';

async function carregarContato() {
  try {
    const urlCompleta = `${API_URL}/api/contato`;
    const res = await fetch(urlCompleta);

    if (res.ok) {
      const data = await res.json();
      if (data) {
        if (data.whatsapp) {
          telefoneWhatsAppGlobal = data.whatsapp.replace(/\D/g, '');
        }
        if (data.instagram_url) {
          instagramUrlGlobal = data.instagram_url;
        }
        if (data.endereco) {
          enderecoGlobal = data.endereco;
          const txtEndereco = document.getElementById('textoEnderecoExibicao');
          if (txtEndereco) {
            txtEndereco.innerText = enderecoGlobal;
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro ao buscar contato:", err);
  } finally {
    const btnWhatsapp = document.getElementById('btnWhatsappFlutuante');
    if (btnWhatsapp) {
      if (telefoneWhatsAppGlobal) {
        const mensagemPadrao = encodeURIComponent("Olá, Paty! Gostaria de tirar uma dúvida.");
        btnWhatsapp.href = `https://wa.me/${telefoneWhatsAppGlobal}?text=${mensagemPadrao}`;
        btnWhatsapp.style.display = 'flex';
      } else {
        btnWhatsapp.style.display = 'none';
      }
    }

    const btnInstagram = document.getElementById('btnInstagramFlutuante');
    if (btnInstagram) {
      if (instagramUrlGlobal) {
        btnInstagram.href = instagramUrlGlobal;
        btnInstagram.style.display = 'flex';
      } else {
        btnInstagram.style.display = 'none';
      }
    }

    const linkMaps = document.getElementById('linkGoogleMaps');
    const linkUber = document.getElementById('linkUber');

    if (enderecoGlobal) {
      const enderecoEncoded = encodeURIComponent(enderecoGlobal);
      if (linkMaps) linkMaps.href = `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`;
      if (linkUber) linkUber.href = `https://m.uber.com/ul/?action=setPickup&dropoff[formatted_address]=${enderecoEncoded}`;
    } else {
      if (linkMaps) linkMaps.removeAttribute('href');
      if (linkUber) linkUber.removeAttribute('href');
    }
  }
}

function enviarAgendamentoWhatsApp(dados) {
  const mensagem = encodeURIComponent(
    `Olá, Paty! Gostaria de agendar um horário.\n\n` +
    `👤 *Nome:* ${dados.nome}\n` +
    `💇 *Serviço:* ${dados.servico}\n` +
    `📅 *Data:* ${dados.data}\n` +
    `⏰ *Horário:* ${dados.horario}`
  );

  window.open(`https://wa.me/${telefoneWhatsAppGlobal}?text=${mensagem}`, '_blank');
}

function abrirModalLocalizacao() {
  const modal = document.getElementById('modalLocalizacao');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function fecharModalLocalizacao(e, forcar = false) {
  const modal = document.getElementById('modalLocalizacao');
  if (!modal) return;
  
  if (forcar || (e && e.target.id === 'modalLocalizacao')) {
    modal.style.display = 'none';
  }
}

// APENAS UMA VERSÃO LIMPA E CORRETA DA INICIALIZAÇÃO DO CALENDÁRIO
async function inicializarCalendario() {
  const inputData = document.getElementById('data');
  const selectHorarios = document.getElementById('horario');
  
  if (!inputData || typeof flatpickr === 'undefined') return;

  try {
    const resposta = await fetch(`${API_URL}/api/agenda/dias`);
    let diasPermitidos = [];
    
    if (resposta.ok) {
      diasPermitidos = await resposta.json();
    }

    flatpickr(inputData, {
      locale: "pt",
      dateFormat: "Y-m-d",
      minDate: "today",
      enable: diasPermitidos,
      onChange: async function(selectedDates, dateStr, instance) {
        if (!dateStr) {
          limparHorarios();
          return;
        }
        await carregarHorariosDisponiveis(dateStr);
      }
    });

  } catch (err) {
    console.error("Erro ao carregar dias disponíveis:", err);
  }

  // Trava de segurança: se clicar no campo de horário sem ter data escolhida
  if (selectHorarios) {
    selectHorarios.addEventListener('mousedown', function(e) {
      if (!inputData.value) {
        e.preventDefault(); 
        alert("Por favor, selecione uma data no calendário primeiro!");
        inputData.focus();
      }
    });
  }
}

// Função para buscar e renderizar os horários do dia selecionado
async function carregarHorariosDisponiveis(dataStr) {
  const selectHorarios = document.getElementById('horario');
  if (!selectHorarios) return;

  selectHorarios.innerHTML = '<option value="">Carregando horários...</option>';

  try {
    const resposta = await fetch(`${API_URL}/api/agenda/horarios/${dataStr}`);
    if (!resposta.ok) throw new Error("Erro ao buscar horários");

    const horarios = await resposta.json();

    selectHorarios.innerHTML = '<option value="">Selecione um horário</option>';

    if (horarios.length === 0) {
      selectHorarios.innerHTML = '<option value="">Nenhum horário disponível para esta data</option>';
      return;
    }

    horarios.forEach(horario => {
      const option = document.createElement('option');
      option.value = horario;
      option.textContent = horario;
      selectHorarios.appendChild(option);
    });

  } catch (err) {
    console.error("Erro ao carregar horários:", err);
    selectHorarios.innerHTML = '<option value="">Erro ao carregar horários</option>';
  }
}

// Função auxiliar para resetar o select de horários
function limparHorarios() {
  const selectHorarios = document.getElementById('horario');
  if (selectHorarios) {
    selectHorarios.innerHTML = '<option value="">Selecione uma data primeiro</option>';
  }
}

// INICIALIZAÇÃO ÚNICA AO CARREGAR O DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
  resetarTemporizadorInatividade();
  carregarLogo();
  carregarBanners();
  carregarServicos();
  carregarAgendamentos();
  carregarContato(); 
  inicializarCalendario(); 
});