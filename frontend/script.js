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
    user_id: MEU_USER_ID, // <-- Envia o ID único do dispositivo
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
      carregarAgendamentos(); 
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
    // Busca os agendamentos passando o ID específico deste usuário na URL
    const res = await fetch(`${API_URL}/api/agendamentos/${MEU_USER_ID}`);
    const agendamentos = await res.json();

    if (res.ok && Array.isArray(agendamentos) && agendamentos.length > 0) {
      container.innerHTML = agendamentos.map(item => `
        <div class="agendamento-card">
          <div>
            <strong>${item.cliente_nome}</strong> (${item.servico})<br>
            <small style="color:var(--text-muted)">📱 ${item.cliente_telefone}</small>
          </div>
          <div style="text-align:right;">
            📅 ${item.data_agendamento}<br>
            ⏰ ${item.horario}
          </div>
        </div>
      `).join('');
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
const TEMPO_PARA_ESCONDER = 3500; // Tempo em milissegundos (3.5 segundos)

function resetarTemporizadorInatividade() {
  const container = document.querySelector('.social-float-container');
  if (!container) return;

  // Mostra os botões novamente
  container.classList.remove('hidden-idle');

  // Reinicia a contagem
  clearTimeout(tempoInatividade);

  // Agenda para esconder após o tempo definido de inatividade
  tempoInatividade = setTimeout(() => {
    container.classList.add('hidden-idle');
  }, TEMPO_PARA_ESCONDER);
}

// Eventos que detectam qualquer movimento ou ação do usuário
['mousemove', 'mousedown', 'touchstart', 'scroll', 'keydown'].forEach(evento => {
  window.addEventListener(evento, resetarTemporizadorInatividade, { passive: true });
});

// Variáveis Globais de Contato (Iniciadas vazias, sem fallbacks estáticos)
let telefoneWhatsAppGlobal = '';
let instagramUrlGlobal = '';
let enderecoGlobal = '';

async function carregarContato() {
  console.log("🔍 [DEBUG] Iniciando o carregamento de contato...");
  console.log("🔍 [DEBUG] API_URL configurada:", typeof API_URL !== 'undefined' ? API_URL : "API_URL não definida!");

  try {
    const urlCompleta = `${API_URL}/api/contato`;
    console.log("🔍 [DEBUG] Fazendo fetch para:", urlCompleta);

    const res = await fetch(urlCompleta);
    console.log("🔍 [DEBUG] Resposta recebida. Status:", res.status, res.statusText);

    if (res.ok) {
      const data = await res.json();
      console.log("✅ [DEBUG] Dados de contato obtidos do banco com sucesso:", data);

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
    } else {
      console.warn("⚠️ [DEBUG] O servidor respondeu, mas com erro HTTP:", res.status);
    }
  } catch (err) {
    console.error("❌ [DEBUG] Erro crítico ao tentar buscar contato:", err);
  } finally {
    console.log("🔍 [DEBUG] Aplicando valores do banco aos botões...");
    console.log("   - WhatsApp:", telefoneWhatsAppGlobal || "Não definido");
    console.log("   - Instagram:", instagramUrlGlobal || "Não definido");
    console.log("   - Endereço:", enderecoGlobal || "Não definido");

    // Atualiza o botão flutuante do WhatsApp apenas se houver número cadastrado
    const btnWhatsapp = document.getElementById('btnWhatsappFlutuante');
    if (btnWhatsapp) {
      if (telefoneWhatsAppGlobal) {
        const mensagemPadrao = encodeURIComponent("Olá, Paty! Gostaria de tirar uma dúvida.");
        btnWhatsapp.href = `https://wa.me/${telefoneWhatsAppGlobal}?text=${mensagemPadrao}`;
        btnWhatsapp.style.display = 'flex'; // Garante que aparece
      } else {
        btnWhatsapp.style.display = 'none'; // Esconde se não houver dados
      }
    }

    // Atualiza o botão flutuante do Instagram apenas se houver URL cadastrada
    const btnInstagram = document.getElementById('btnInstagramFlutuante');
    if (btnInstagram) {
      if (instagramUrlGlobal) {
        btnInstagram.href = instagramUrlGlobal;
        btnInstagram.style.display = 'flex';
      } else {
        btnInstagram.style.display = 'none';
      }
    }

    // Configura os links de rotas (Google Maps e Uber) apenas se houver endereço
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



// Função de envio do agendamento montando a URL com o número vindo do Firestore
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

// Funções do Modal de Localização
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

// INICIALIZAÇÃO ÚNICA AO CARREGAR O DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
  resetarTemporizadorInatividade();
  carregarLogo();
  carregarBanners();
  carregarServicos();
  carregarAgendamentos();
  carregarContato(); 
});