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
      
      // Monta os cards na tela
      renderizarGridServicos(listaServicosGlobal);

      // Preenche o campo de seleção do formulário de agendamento
      if (selectServico && listaServicosGlobal.length > 0) {
        selectServico.innerHTML = `
          <option value="">-- Selecione o modelo --</option>
        ` + listaServicosGlobal.map(item => `
          <option value="${item.nome}">${item.nome} (${item.preco})</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error("Erro ao carregar serviços:", err);
  }
}

// Função para renderizar os cards de serviços
function renderizarGridServicos(servicos) {
  const container = document.getElementById('gridServicos');
  if (!container) return;

  if (servicos.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px 0;">🔍 Nenhum serviço encontrado.</p>`;
    return;
  }

  container.innerHTML = servicos.map((item) => {
    // Mapeia o índice original do serviço para manter o modal correto
    const indexOriginal = listaServicosGlobal.findIndex(s => s.nome === item.nome);
    return `
      <div class="card-servico" onclick="abrirModalServico(${indexOriginal})">
        <h3>${item.nome}</h3>
        <img src="${item.foto_url}" alt="${item.nome}" class="card-servico-img">
        <p>${item.descricao_curta}</p>

        <div class="info-rapida-servico">
          <span>⏱️ <strong>Execução:</strong> ${item.tempo_fazer || 'Sob consulta'}</span><br>
          <span>⏳ <strong>Duração:</strong> ${item.durabilidade || 'Sob consulta'}</span>
        </div>

        <span class="price-tag">${item.preco}</span>
      </div>
    `;
  }).join('');
}

// Função para filtrar os serviços em tempo real enquanto digita
function filtrarServicos() {
  const input = document.getElementById('inputBuscaServico');
  if (!input) return;
  const termo = input.value.toLowerCase().trim();

  const filtrados = listaServicosGlobal.filter(item => {
    const nome = (item.nome || '').toLowerCase();
    const desc = (item.descricao_curta || '').toLowerCase();
    return nome.includes(termo) || desc.includes(termo);
  });

  renderizarGridServicos(filtrados);
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
  // Se você criou um campo de input/textarea para observação no HTML, pegue o valor dele aqui:
  const inputObservacao = document.getElementById('observacaoIA'); // Ajuste o ID conforme o HTML do seu input
  const observacaoTexto = inputObservacao ? inputObservacao.value : '';

  const divResultado = document.getElementById('resultadoIA');

  if (!fileInput.files[0]) {
    alert("Selecione uma foto do modelo primeiro!");
    return;
  }

  divResultado.style.display = 'block';
  divResultado.innerHTML = "⏳ <em>Analisando imagem com o Gemini IA... Aguarde alguns segundos.</em>";

  const formData = new FormData();
  formData.append("foto", fileInput.files[0]);
  formData.append("observacao", observacaoTexto); // Envia a observação opcional para o backend

  try {
    const res = await fetch(`${API_URL}/api/analisar-ia`, { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      divResultado.innerHTML = `
        <h3 style="color:#c25975; margin-bottom:10px;">✨ Análise Concluída</h3>
        <p><strong>Estilo Identificado:</strong> ${data.estilo_identificado || 'Não especificado'}</p>
        <p><strong>Dificuldade:</strong> ${data.dificuldade || data.Complexidade || 'Média'}</p>
        <p><strong>Tempo Estimado:</strong> ${data.tempo_estimado_minutos || '--'} minutos</p>
        <p style="margin-top:8px;"><strong>Observação:</strong> ${data.observacao || 'Nenhuma observação.'}</p>
      `;
    } else {
      divResultado.innerHTML = `<p style='color:#ef4444;'>❌ ${data.detail || 'Ocorreu um erro ao processar a imagem no servidor.'}</p>`;
    }
  } catch (err) {
    divResultado.innerHTML = "<p style='color:#ef4444;'>❌ Erro ao conectar com o serviço de IA.</p>";
  }
}

let idAgendamentoEmReagendamento = null;
let statusAgendamentoEmReagendamento = null;

async function agendar(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('mensagemStatus');

  // 1. Limpa qualquer mensagem de status/erro anterior
  statusDiv.innerHTML = "";

  // Captura e limpa os valores digitados nos campos
  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const telefoneApenasNumeros = telefone.replace(/\D/g, '');
  const servico = document.getElementById('servico').value.trim();
  const dataAgendamento = document.getElementById('data').value.trim();
  const horario = document.getElementById('horario').value.trim();

  // 2. Validações campo a campo com foco e mensagens específicas

  if (!nome) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Por favor, preencha o seu Nome Completo.</p>";
    document.getElementById('nome').focus();
    return;
  }

  if (telefoneApenasNumeros.length < 10 || telefoneApenasNumeros.length > 11) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Telefone incompleto. Preencha o DDD + número completo no formato (XX) 9XXXX-XXXX.</p>";
    document.getElementById('telefone').focus();
    return;
  }

  if (!servico) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Por favor, selecione um Serviço/Modelo.</p>";
    document.getElementById('servico').focus();
    return;
  }

  if (!dataAgendamento) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Por favor, selecione a Data de Atendimento.</p>";
    document.getElementById('data').focus();
    return;
  }

  if (!horario) {
    statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Por favor, selecione um Horário de Atendimento.</p>";
    document.getElementById('horario').focus();
    return;
  }

  // CENÁRIO 1: Reagendamento de agendamento CONFIRMADO (Aprovado / Confirmado)
  if (idAgendamentoEmReagendamento && (statusAgendamentoEmReagendamento === "Confirmado" || statusAgendamentoEmReagendamento === "Aprovado")) {
    statusDiv.innerHTML = "Enviando solicitação de reagendamento...";
    await enviarSolicitacaoReagendamentoAprovado(idAgendamentoEmReagendamento, statusAgendamentoEmReagendamento, dataAgendamento, horario);
    return;
  }

  // CENÁRIO 2 e Novo Agendamento
  statusDiv.innerHTML = "Salvando agendamento...";

  const payload = {
    user_id: MEU_USER_ID,
    cliente_nome: nome,
    cliente_telefone: telefone,
    servico: servico,
    data_agendamento: dataAgendamento,
    horario: horario
  };

  try {
    const res = await fetch(`${API_URL}/api/agendamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      // Se era um reagendamento de item PENDENTE, agora podemos remover o antigo com segurança
      if (idAgendamentoEmReagendamento && statusAgendamentoEmReagendamento === "Pendente") {
        try {
          await fetch(`${API_URL}/api/agendamentos/cancelar/${MEU_USER_ID}/${idAgendamentoEmReagendamento}?status=Pendente`, {
            method: "DELETE"
          });
        } catch (exOld) {
          console.error("Erro ao cancelar agendamento antigo após reagendar:", exOld);
        }
      }

      statusDiv.innerHTML = "<p style='color:#22c55e;'>✅ Agendamento realizado com sucesso!</p>";
      cancelarModoReagendamento();
      carregarAgendamentos();

      // Faz a mensagem de sucesso sumir após 5 segundos
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
  idAgendamentoEmReagendamento = docId;
  statusAgendamentoEmReagendamento = statusAtual;

  const inputNome = document.getElementById('nome');
  const inputTelefone = document.getElementById('telefone');
  const selectServico = document.getElementById('servico');
  const inputData = document.getElementById('data');

  if (inputNome) inputNome.value = nome || '';
  if (inputTelefone) inputTelefone.value = telefone || '';
  if (selectServico) selectServico.value = servico || '';
  if (inputData) inputData.value = '';

  limparHorarios();
  inicializarCalendario();

  const btnSubmit = document.getElementById('btnSubmitAgendamento');
  const btnCancelar = document.getElementById('btnCancelarReagendamento');

  if (statusAtual === "Confirmado" || statusAtual === "Aprovado") {
    if (btnSubmit) btnSubmit.innerText = "🔄 Solicitar Reagendamento";
    if (btnCancelar) btnCancelar.style.display = "block";
    alert("📌 Escolha a nova data e horário. A solicitação de reagendamento será enviada para aprovação do administrador.");
  } else {
    // Status "Pendente"
    if (btnSubmit) btnSubmit.innerText = "🔄 Confirmar Reagendamento";
    if (btnCancelar) btnCancelar.style.display = "block";
    alert("📌 Escolha a nova data e horário. O agendamento antigo só será substituído quando você confirmar o novo!");
  }

  const formElement = document.getElementById('formAgendamento');
  if (formElement) {
    formElement.scrollIntoView({ behavior: 'smooth' });
  }
}

function cancelarModoReagendamento() {
  idAgendamentoEmReagendamento = null;
  statusAgendamentoEmReagendamento = null;

  const formElement = document.getElementById('formAgendamento');
  if (formElement) formElement.reset();
  limparHorarios();

  const btnSubmit = document.getElementById('btnSubmitAgendamento');
  const btnCancelar = document.getElementById('btnCancelarReagendamento');

  if (btnSubmit) btnSubmit.innerText = "✨ Confirmar Agendamento";
  if (btnCancelar) btnCancelar.style.display = "none";
}

async function enviarSolicitacaoReagendamentoAprovado(docId, statusAtual, novaData, novoHorario) {
  const payload = {
    user_id: MEU_USER_ID,
    doc_id: docId,
    status_atual: statusAtual,
    nova_data: novaData,
    novo_horario: novoHorario
  };

  const statusDiv = document.getElementById('mensagemStatus');

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/reagendar-aprovado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (statusDiv) statusDiv.innerHTML = `<p style='color:#22c55e;'>✅ ${data.mensagem}</p>`;
      cancelarModoReagendamento();
      carregarAgendamentos();

      setTimeout(() => {
        if (statusDiv) statusDiv.innerHTML = "";
      }, 5000);
    } else {
      if (statusDiv) statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Erro ao solicitar reagendamento.</p>";
    }
  } catch (err) {
    console.error("Erro:", err);
    if (statusDiv) statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Erro de conexão com o servidor.</p>";
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
let instanciaFlatpickr = null;

async function inicializarCalendario() {
  const inputData = document.getElementById('data');
  const selectServico = document.getElementById('servico');
  const selectHorarios = document.getElementById('horario');
  
  if (!inputData || typeof flatpickr === 'undefined') return;

  try {
    // Busca inicial de dias (sem serviço ou com o atual)
    const servicoAtual = selectServico ? selectServico.value : '';
    const urlDias = servicoAtual ? `${API_URL}/api/agenda/dias?servico=${encodeURIComponent(servicoAtual)}` : `${API_URL}/api/agenda/dias`;
    
    const resposta = await fetch(urlDias);
    let diasPermitidos = [];
    
    if (resposta.ok) {
      diasPermitidos = await resposta.json();
    }

    if (instanciaFlatpickr) {
      instanciaFlatpickr.destroy();
    }

    instanciaFlatpickr = flatpickr(inputData, {
      locale: "pt",
      dateFormat: "Y-m-d",
      minDate: "today",
      enable: diasPermitidos,
      // 🔒 TRAVA DE SEGURANÇA ANTES DE ABRIR O CALENDÁRIO
      onOpen: function(selectedDates, dateStr, instance) {
        const servicoSelecionado = selectServico ? selectServico.value : '';
        if (!servicoSelecionado || servicoSelecionado === "None" || servicoSelecionado.trim() === "") {
          instance.close(); // Fecha o calendário imediatamente
          alert("⚠️ Por favor, selecione um serviço primeiro antes de escolher a data!");
          if (selectServico) selectServico.focus();
        }
      },
      onChange: async function(selectedDates, dateStr, instance) {
        if (!dateStr) {
          limparHorarios();
          return;
        }
        const servicoSelecionado = selectServico ? selectServico.value : '';
        await carregarHorariosDisponiveis(dateStr, servicoSelecionado);
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
async function carregarHorariosDisponiveis(dataStr, servico = '') {
  const selectHorarios = document.getElementById('horario');
  if (!selectHorarios) return;

  selectHorarios.innerHTML = '<option value="">Carregando horários...</option>';

  try {
    const urlHorarios = servico 
      ? `${API_URL}/api/agenda/horarios/${dataStr}?servico=${encodeURIComponent(servico)}`
      : `${API_URL}/api/agenda/horarios/${dataStr}`;

    const resposta = await fetch(urlHorarios);
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

  // NOVO: Quando o usuário trocar o serviço no select, reinicia o calendário e limpa data/horário
  const selectServico = document.getElementById('servico');
  if (selectServico) {
    selectServico.addEventListener('change', () => {
      const inputData = document.getElementById('data');
      if (inputData) inputData.value = ''; // Limpa a data escolhida anteriormente
      limparHorarios();
      inicializarCalendario(); // Recarrega os dias disponíveis com base no novo serviço
    });
  }
});
// Máscara automática para telefone/WhatsApp no padrão (DD) XXXXX-XXXX ou (DD) XXXX-XXXX
const inputTelefone = document.getElementById('telefone');
if (inputTelefone) {
  inputTelefone.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 10) {
      // Formato para Celular com 9 dígitos: (XX) XXXXX-XXXX
      v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (v.length > 6) {
      // Formato intermediário / Fixo com 8 dígitos: (XX) XXXX-XXXX
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (v.length > 2) {
      // Formato inicial com DDD: (XX) XXXX...
      v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (v.length > 0) {
      // Apenas DDD: (XX...
      v = v.replace(/^(\d{0,2})$/, '($1');
    }

    e.target.value = v;
  });
}
// Exibe a mensagem no rodapé mesmo quando o balão nativo "Preencha este campo" do HTML for acionado
const form = document.getElementById('formAgendamento');
if (form) {
  form.addEventListener('invalid', (e) => {
    const statusDiv = document.getElementById('mensagemStatus');
    if (statusDiv) {
      statusDiv.innerHTML = "<p style='color:#ef4444;'>❌ Por favor, preencha todos os campos obrigatórios com atenção.</p>";
    }
  }, true); // O argumento 'true' permite capturar o erro de qualquer campo do formulário
}