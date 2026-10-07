const API_URL = "https://patytrancas2.onrender.com";

// Formata datas AAAA-MM-DD para o padrão visual brasileiro DD/MM/AAAA
function formatarDataBR(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') return dataStr || '';
  const partes = dataStr.trim().split('-');
  if (partes.length === 3 && partes[0].length === 4) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

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

let bannersGlobal = [];
let bannerIndexAtual = 0;
let bannerTimerGlobal = null;

// Busca os banners dinâmicos no servidor e gerencia o carrossel
async function carregarBanners() {
  try {
    const res = await fetch(`${API_URL}/api/banners`);
    if (res.ok) {
      const data = await res.json();
      
      if (!data || data.ativo === false) {
        const heroSection = document.getElementById('home');
        if (heroSection) heroSection.style.display = 'none';
        return;
      }

      if (Array.isArray(data.banners) && data.banners.length > 0) {
        bannersGlobal = data.banners;
      } else if (data.desktop_url) {
        bannersGlobal = [{
          desktop_url: data.desktop_url,
          mobile_url: data.mobile_url || data.desktop_url,
          link: data.link || '#agendar',
          servico_preencher: ''
        }];
      }

      if (bannersGlobal.length === 0) {
        const heroSection = document.getElementById('home');
        if (heroSection) heroSection.style.display = 'none';
        return;
      }

      const tempoSegundos = data.tempo_segundos || 5;
      iniciarCarrosselBanners(tempoSegundos);
    }
  } catch (err) {
    console.error("Erro ao carregar banners:", err);
  }
}

function iniciarCarrosselBanners(tempoSegundos) {
  bannerIndexAtual = 0;

  const prevBtn = document.getElementById('bannerPrevBtn');
  const nextBtn = document.getElementById('bannerNextBtn');
  const dotsContainer = document.getElementById('bannerDots');
  const wrapper = document.getElementById('carouselWrapper');

  if (bannersGlobal.length <= 1) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (dotsContainer) dotsContainer.style.display = 'none';
  } else {
    if (prevBtn) {
      prevBtn.style.display = 'flex';
      prevBtn.onclick = (e) => {
        e.preventDefault();
        mudarBanner(bannerIndexAtual - 1, tempoSegundos);
      };
    }
    if (nextBtn) {
      nextBtn.style.display = 'flex';
      nextBtn.onclick = (e) => {
        e.preventDefault();
        mudarBanner(bannerIndexAtual + 1, tempoSegundos);
      };
    }
  }

  // Suporte a gestos Touch (Swipe no Mobile)
  if (wrapper && !wrapper.dataset.swipeBound) {
    wrapper.dataset.swipeBound = 'true';
    let startX = 0;
    let endX = 0;

    wrapper.addEventListener('touchstart', (e) => {
      startX = e.changedTouches[0].screenX;
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].screenX;
      if (startX - endX > 40) {
        mudarBanner(bannerIndexAtual + 1, tempoSegundos);
      } else if (endX - startX > 40) {
        mudarBanner(bannerIndexAtual - 1, tempoSegundos);
      }
    }, { passive: true });
  }

  renderizarDotsBanners(tempoSegundos);
  exibirBannerAtual();
  iniciarTimerCarrossel(tempoSegundos);
}

function renderizarDotsBanners(tempoSegundos) {
  const dotsContainer = document.getElementById('bannerDots');
  if (!dotsContainer) return;

  dotsContainer.innerHTML = '';
  if (bannersGlobal.length <= 1) {
    dotsContainer.style.display = 'none';
    return;
  }

  dotsContainer.style.display = 'flex';

  bannersGlobal.forEach((_, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `carousel-dot ${idx === bannerIndexAtual ? 'active' : ''}`;
    dot.setAttribute('aria-label', `Ir para o banner ${idx + 1}`);
    dot.onclick = (e) => {
      e.preventDefault();
      mudarBanner(idx, tempoSegundos);
    };
    dotsContainer.appendChild(dot);
  });
}

function mudarBanner(novoIndex, tempoSegundos) {
  if (bannersGlobal.length === 0) return;

  if (novoIndex < 0) {
    bannerIndexAtual = bannersGlobal.length - 1;
  } else if (novoIndex >= bannersGlobal.length) {
    bannerIndexAtual = 0;
  } else {
    bannerIndexAtual = novoIndex;
  }

  exibirBannerAtual();
  renderizarDotsBanners(tempoSegundos);
  iniciarTimerCarrossel(tempoSegundos);
}

function exibirBannerAtual() {
  const item = bannersGlobal[bannerIndexAtual];
  if (!item) return;

  const desktopImg = document.getElementById('bannerDesktopImg');
  const mobileSource = document.getElementById('bannerMobileSource');
  const bannerLink = document.getElementById('bannerLink');

  if (desktopImg) desktopImg.src = item.desktop_url || item.mobile_url || '';
  if (mobileSource) mobileSource.srcset = item.mobile_url || item.desktop_url || '';

  if (bannerLink) {
    bannerLink.href = item.link || '#agendar';
    bannerLink.onclick = () => {
      if (item.servico_preencher) {
        const selectServico = document.getElementById('servico');
        if (selectServico) {
          selectServico.value = item.servico_preencher;
          selectServico.dispatchEvent(new Event('change'));
        }
      }
    };
  }
}

function iniciarTimerCarrossel(tempoSegundos) {
  if (bannerTimerGlobal) clearInterval(bannerTimerGlobal);
  if (bannersGlobal.length <= 1) return;

  const ms = (tempoSegundos || 5) * 1000;
  bannerTimerGlobal = setInterval(() => {
    mudarBanner(bannerIndexAtual + 1, tempoSegundos);
  }, ms);
}

let listaServicosGlobal = [];
let meusFavoritos = [];
let categoriasFiltroAtivas = new Set(); // Guarda as categorias selecionadas (ex: 'masculina', 'favorito')

// Busca a lista de favoritos do usuário
async function carregarFavoritos() {
  // 1. Tenta carregar do localStorage do navegador para carregamento instantâneo
  const localFavs = localStorage.getItem('paty_trancas_favoritos');
  if (localFavs) {
    try {
      meusFavoritos = JSON.parse(localFavs) || [];
    } catch (_) {}
  }

  // 2. Sincroniza com o banco de dados Firebase no servidor
  try {
    const res = await fetch(`${API_URL}/api/favoritos/${MEU_USER_ID}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.favoritos)) {
        meusFavoritos = data.favoritos;
        localStorage.setItem('paty_trancas_favoritos', JSON.stringify(meusFavoritos));
      }
    }
  } catch (err) {
    console.error("Erro ao carregar favoritos do servidor:", err);
  }
}

// Marca/Desmarca um serviço como favorito
async function toggleFavorito(event, servicoNome) {
  if (event) event.stopPropagation();

  if (meusFavoritos.includes(servicoNome)) {
    meusFavoritos = meusFavoritos.filter(f => f !== servicoNome);
  } else {
    meusFavoritos.push(servicoNome);
  }

  localStorage.setItem('paty_trancas_favoritos', JSON.stringify(meusFavoritos));
  filtrarServicos();

  try {
    const res = await fetch(`${API_URL}/api/favoritos/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: MEU_USER_ID, servico_nome: servicoNome })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.favoritos)) {
        meusFavoritos = data.favoritos;
        localStorage.setItem('paty_trancas_favoritos', JSON.stringify(meusFavoritos));
      }
    }
  } catch (err) {
    console.error("Erro ao alternar favorito no servidor:", err);
  }
}

// Alterna a exibição dos botões de filtro
function toggleFiltrosOpcoes() {
  const container = document.getElementById('filtroOpcoesContainer');
  if (container) {
    container.style.display = container.style.display === 'none' ? 'flex' : 'none';
  }
}

// Seleciona/Deseleciona múltiplas categorias de filtro
function selecionarCategoriaFiltro(categoria, el) {
  if (el && typeof el.blur === 'function') {
    el.blur(); // Remove o foco nativo do navegador para a cor do botão atualizar instantaneamente
  }

  const chipTodas = document.querySelector('.chip-filtro[data-categoria="todas"]');

  if (categoria === 'todas') {
    // Se clicou em "Todas": limpa todas as seleções ativas
    categoriasFiltroAtivas.clear();
    document.querySelectorAll('.chip-filtro').forEach(chip => chip.classList.remove('active'));
    if (chipTodas) chipTodas.classList.add('active');
  } else {
    // Se clicou em uma categoria específica (feminina, masculina, favorito)
    if (chipTodas) chipTodas.classList.remove('active');

    if (categoriasFiltroAtivas.has(categoria)) {
      categoriasFiltroAtivas.delete(categoria);
      if (el) el.classList.remove('active');
    } else {
      categoriasFiltroAtivas.add(categoria);
      if (el) el.classList.add('active');
    }

    // Se desmarcou tudo, ativa "Todas" automaticamente
    if (categoriasFiltroAtivas.size === 0) {
      if (chipTodas) chipTodas.classList.add('active');
    }
  }

  filtrarServicos();
}

// Busca serviços no banco e preenche a tela + o select do formulário
async function carregarServicos() {
  const selectServico = document.getElementById('servico');

  try {
    await carregarFavoritos();
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
    const indexOriginal = listaServicosGlobal.findIndex(s => s.nome === item.nome);
    const isFav = meusFavoritos.includes(item.nome);

    return `
      <div class="card-servico" onclick="abrirModalServico(${indexOriginal})">
        <div class="card-servico-header">
          <h3>${item.nome}</h3>
          <button class="btn-heart-favorite" onclick="toggleFavorito(event, '${item.nome}')" title="Favoritar">
            <i class="${isFav ? 'fas fa-heart active' : 'far fa-heart'}"></i>
          </button>
        </div>
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

// Função para filtrar os serviços em tempo real com suporte a lógica de gênero e favoritos
function filtrarServicos() {
  const input = document.getElementById('inputBuscaServico');
  const termo = input ? input.value.toLowerCase().trim() : '';

  const temFeminina = categoriasFiltroAtivas.has('feminina');
  const temMasculina = categoriasFiltroAtivas.has('masculina');
  const temUnissex = categoriasFiltroAtivas.has('unissex');
  const temFavorito = categoriasFiltroAtivas.has('favorito');

  const filtrados = listaServicosGlobal.filter(item => {
    const nome = (item.nome || '').toLowerCase();
    const desc = (item.descricao_curta || '').toLowerCase();
    const cat = (item.categoria || '').toLowerCase();

    // 1. Filtro por Busca de Texto
    const bateTexto = !termo || nome.includes(termo) || desc.includes(termo);

    // 2. Filtro por Gênero
    let bateGenero = true;
    if (temFeminina || temMasculina || temUnissex) {
      const eFeminina = cat.includes('feminin') || cat.includes('unissex') || nome.includes('feminin') || (!cat.includes('masculin') && !nome.includes('masculin') && !desc.includes('masculin') && !desc.includes('homem'));
      const eMasculina = cat.includes('masculin') || cat.includes('unissex') || nome.includes('masculin') || desc.includes('masculin') || desc.includes('homem');
      const eUnissex = cat.includes('unissex') || (eFeminina && eMasculina);

      const generosAtivos = [];
      if (temFeminina) generosAtivos.push(eFeminina);
      if (temMasculina) generosAtivos.push(eMasculina);
      if (temUnissex) generosAtivos.push(eUnissex);

      // União (OU) entre gêneros selecionados
      bateGenero = generosAtivos.some(cond => cond === true);
    }

    // 3. Filtro por Favorito (Interseção E)
    let bateFavorito = true;
    if (temFavorito) {
      bateFavorito = meusFavoritos.includes(item.nome);
    }

    return bateTexto && bateGenero && bateFavorito;
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
  const isConfirmadoEmReag = statusAgendamentoEmReagendamento &&
    (statusAgendamentoEmReagendamento.toLowerCase() === "confirmado" || statusAgendamentoEmReagendamento.toLowerCase() === "aprovado");

  if (idAgendamentoEmReagendamento && isConfirmadoEmReag) {
    statusDiv.innerHTML = "Enviando solicitação de reagendamento...";
    await enviarSolicitacaoReagendamentoAprovado(idAgendamentoEmReagendamento, statusAgendamentoEmReagendamento, dataAgendamento, horario);
    return;
  }

  // CENÁRIO 2 e Novo Agendamento
  statusDiv.innerHTML = "Salvando agendamento...";

  const payload = {
    user_id: MEU_USER_ID,
    cliente_nome: nome,
    cliente_telefone: telefoneApenasNumeros,
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

// Verifica se o agendamento já passou da data e horário atuais
function agendamentoJaPassou(dataStr, horarioStr) {
  if (!dataStr || !horarioStr) return false;
  try {
    const horaPadronizada = horarioStr.length === 4 ? '0' + horarioStr : horarioStr;
    const dtAgend = new Date(`${dataStr}T${horaPadronizada}:00`);
    const agora = new Date();
    return dtAgend < agora;
  } catch (e) {
    return false;
  }
}

let abaAgendamentosAtual = 'agendamentos';
let modalAvaliacaoJaAbertoAut = false;

function selecionarAbaAgendamentos(aba, el) {
  if (el && typeof el.blur === 'function') el.blur();
  abaAgendamentosAtual = aba;

  const tabs = document.querySelectorAll('.agendamento-tab');
  tabs.forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  carregarAgendamentos();
}

async function carregarAgendamentos() {
  const container = document.getElementById('listaAgendamentos');
  if (!container) return;
  
  container.innerHTML = "Buscando agendamentos...";

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${MEU_USER_ID}`);
    const agendamentos = await res.json();

    if (res.ok && Array.isArray(agendamentos) && agendamentos.length > 0) {
      // 1. Abre pop-up com fundo desfocado se houver atendimento concluído pendente de avaliação
      const pendenteAvaliacao = agendamentos.find(item => item.status_conclusao === true && !item.avaliacao_feita);
      if (pendenteAvaliacao && !modalAvaliacaoJaAbertoAut) {
        modalAvaliacaoJaAbertoAut = true;
        setTimeout(() => {
          abrirModalAvaliacao(pendenteAvaliacao.id);
        }, 800);
      }

      // 2. Filtra por aba (Agendamentos x Histórico)
      const agendamentosFiltrados = agendamentos.filter(item => {
        const jaPassou = agendamentoJaPassou(item.data_agendamento, item.horario);
        const stLower = (item.status || "").toString().toLowerCase().trim();
        const isCancelado = stLower === "cancelado";

        if (abaAgendamentosAtual === 'agendamentos') {
          return !jaPassou && !isCancelado;
        } else {
          return true; // Histórico mostra tudo
        }
      });

      if (agendamentosFiltrados.length === 0) {
        const msgVazia = abaAgendamentosAtual === 'agendamentos'
          ? "Nenhum agendamento futuro encontrado."
          : "Nenhum histórico de agendamentos encontrado.";
        container.innerHTML = `<p style='color:var(--text-muted); text-align:center;'>${msgVazia}</p>`;
        return;
      }

      container.innerHTML = agendamentosFiltrados.map(item => {
        const servicoEncontrado = listaServicosGlobal.find(s => s.nome === item.servico);
        const precoTexto = servicoEncontrado ? servicoEncontrado.preco : (item.preco || '');
        const stLower = (item.status || "").toString().toLowerCase().trim();
        let corStatus = "#eab308";
        let statusTexto = item.status || 'Pendente, aguardando aprovação';

        if (stLower === "confirmado" || stLower === "aprovado") {
          corStatus = "#22c55e";
          statusTexto = "Confirmado";
        } else if (stLower === "cancelado") {
          corStatus = "#ef4444";
          statusTexto = "Cancelado";
        }

        let boxSolicitacao = '';
        if (item.pedido_cancelamento) {
          boxSolicitacao = `
            <div class="agendamento-solicitacao-box">
              <span>⚠️ Cancelamento solicitado (Aguardando aprovação)</span>
              <button class="btn-cancelar-solicitacao" onclick='desistirSolicitacao("${item.id}")'>❌ Cancelar Solicitação</button>
            </div>
          `;
        } else if (item.pedido_reagendamento) {
          boxSolicitacao = `
            <div class="agendamento-solicitacao-box reagendamento">
              <span>⚠️ Reagendamento para ${formatarDataBR(item.novo_data)} às ${item.novo_horario} (Aguardando aprovação)</span>
              <button class="btn-cancelar-solicitacao" onclick='desistirSolicitacao("${item.id}")'>❌ Cancelar Solicitação</button>
            </div>
          `;
        }

        const jaPassou = agendamentoJaPassou(item.data_agendamento, item.horario);
        let botoesAcao = '';

        if (item.status_conclusao === true) {
          if (item.avaliacao_feita) {
            botoesAcao = `
              <div style="color: var(--gold); font-weight: 600; font-size: 0.9rem; text-align: center; width: 100%; padding: 6px 0;">
                ✨ Atendimento Avaliado (${'⭐'.repeat(item.stars_tranca || 5)})
              </div>
            `;
          } else {
            botoesAcao = `
              <button onclick='abrirModalAvaliacao("${item.id}")' style="background: #d4af37; color: white; width: 100%;">
                ⭐ Avaliar Atendimento
              </button>
            `;
          }
        } else if (jaPassou) {
          botoesAcao = `
            <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; width: 100%; padding: 6px 0; font-weight: 500;">
              ⏳ Horário de atendimento finalizado
            </div>
          `;
        } else {
          botoesAcao = `
            <button onclick='prepararReagendamento("${item.id}", "${item.status}", "${item.cliente_nome}", "${item.cliente_telefone}", "${item.servico}")' style="background: #3b82f6;">
              🔄 Reagendar
            </button>
            <button onclick='executarCancelamento("${item.id}", "${item.status}")' style="background: #ef4444;">
              ❌ Cancelar
            </button>
          `;
        }

        return `
          <div class="agendamento-card" style="border-left: 5px solid ${corStatus};">
            <div class="agendamento-card-header">
              <div>
                <div class="agendamento-cliente">${item.cliente_nome || 'Cliente'}</div>
                <!-- Exibe o Nome do Serviço e o Preço em Dourado -->
                <div class="agendamento-servico">
                  ${item.servico} ${precoTexto ? `<span style="color: var(--gold); font-weight: 700; margin-left: 6px;">(${precoTexto})</span>` : ''}
                </div>
              </div>
              <div class="agendamento-data-badge">
                📅 ${formatarDataBR(item.data_agendamento)} às ${item.horario}
              </div>
            </div>

            <div class="agendamento-info-row">
              <span>📱 ${item.cliente_telefone || 'Sem telefone'}</span>
              <span>Status: <strong style="color: ${corStatus}">${statusTexto}</strong></span>
            </div>

            ${boxSolicitacao}

            <div class="agendamento-card-actions">
              ${botoesAcao}
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
// FUNÇÕES DO MODAL E ESTRELAS DE AVALIAÇÃO DO ATENDIMENTO
// =============================================================
let agendamentoParaAvaliar = null;
let valStarsTempo = 0;
let valStarsTranca = 0;

function abrirModalAvaliacao(docId) {
  agendamentoParaAvaliar = docId;
  valStarsTempo = 0;
  valStarsTranca = 0;

  resetarEstrelas('starsTempoExecucao');
  resetarEstrelas('starsAvaliacaoTranca');

  const inputSug = document.getElementById('inputSugestaoServ');
  if (inputSug) inputSug.value = '';

  const msgDiv = document.getElementById('msgStatusAvaliacao');
  if (msgDiv) msgDiv.innerHTML = '';

  const modal = document.getElementById('modalAvaliacao');
  if (modal) modal.style.display = 'flex';
}

function fecharModalAvaliacao(e, forcar = false) {
  const modal = document.getElementById('modalAvaliacao');
  if (!modal) return;
  if (forcar || (e && e.target.id === 'modalAvaliacao')) {
    modal.style.display = 'none';
  }
}

function selecionarEstrela(containerId, valor) {
  if (containerId === 'starsTempoExecucao') valStarsTempo = valor;
  if (containerId === 'starsAvaliacaoTranca') valStarsTranca = valor;

  const container = document.getElementById(containerId);
  if (!container) return;

  const estrelas = container.querySelectorAll('.star-btn');
  estrelas.forEach((star, index) => {
    if (index < valor) {
      star.className = 'fas fa-star star-btn active';
    } else {
      star.className = 'far fa-star star-btn';
    }
  });
}

function resetarEstrelas(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const estrelas = container.querySelectorAll('.star-btn');
  estrelas.forEach(star => {
    star.className = 'far fa-star star-btn';
  });
}

async function submeterAvaliacao() {
  const msgDiv = document.getElementById('msgStatusAvaliacao');

  if (valStarsTempo === 0 || valStarsTranca === 0) {
    alert("⚠️ Por favor, selecione a quantidade de estrelas tanto para o Tempo quanto para a Trança!");
    return;
  }

  const sugestaoTexto = document.getElementById('inputSugestaoServ').value.trim();

  if (msgDiv) msgDiv.innerHTML = "Enviando avaliação...";

  const payload = {
    user_id: MEU_USER_ID,
    doc_id: agendamentoParaAvaliar,
    stars_tpexc: valStarsTempo,
    stars_tranca: valStarsTranca,
    sugestao_serv: sugestaoTexto
  };

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/avaliar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (msgDiv) msgDiv.innerHTML = "<p style='color:#22c55e;'>✅ Avaliação enviada com sucesso! Muito obrigado!</p>";
      setTimeout(() => {
        fecharModalAvaliacao(null, true);
        carregarAgendamentos();
      }, 1500);
    } else {
      if (msgDiv) msgDiv.innerHTML = "<p style='color:#ef4444;'>❌ Não foi possível salvar a avaliação.</p>";
    }
  } catch (err) {
    console.error("Erro ao avaliar:", err);
    if (msgDiv) msgDiv.innerHTML = "<p style='color:#ef4444;'>❌ Erro de conexão com o servidor.</p>";
  }
}

async function desistirSolicitacao(docId) {
  if (!confirm("Deseja realmente cancelar esta solicitação pendente?")) return;

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/desistir-solicitacao/${MEU_USER_ID}/${docId}`, {
      method: "POST"
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.mensagem || "Solicitação cancelada com sucesso!");
      carregarAgendamentos();
    } else {
      alert("Erro ao cancelar a solicitação.");
    }
  } catch (err) {
    console.error("Erro:", err);
    alert("Erro de conexão com o servidor.");
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

  const stLower = (statusAtual || "").toString().toLowerCase().trim();
  const isConfirmado = stLower === "confirmado" || stLower === "aprovado";

  statusAgendamentoEmReagendamento = isConfirmado ? "Confirmado" : "Pendente";

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

  if (isConfirmado) {
    if (btnSubmit) btnSubmit.innerText = "🔄 Solicitar Reagendamento";
    if (btnCancelar) btnCancelar.style.display = "block";
    alert("📌 Escolha a nova data e horário. A solicitação de reagendamento será enviada para aprovação do administrador.");
  } else {
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
    `📅 *Data:* ${formatarDataBR(dados.data)}\n` +
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

// Busca e renderiza as avaliações e média no site
async function carregarAvaliacoesPublicas() {
  const container = document.getElementById('gridComentariosPublicos');
  const scoreNum = document.getElementById('scoreMediaTranca');
  const starsDisplay = document.getElementById('starsMediaTranca');
  const totalReviewsText = document.getElementById('totalAvaliacoesText');

  try {
    const res = await fetch(`${API_URL}/api/avaliacoes/publicas`);
    if (res.ok) {
      const data = await res.json();

      const media = data.media_tranca || 5.0;
      const total = data.total_avaliacoes || 0;
      const numEstrelas = Math.round(media);

      if (scoreNum) scoreNum.innerText = media.toFixed(1);
      if (starsDisplay) starsDisplay.innerText = '⭐'.repeat(numEstrelas);
      if (totalReviewsText) totalReviewsText.innerText = `Média baseada em ${total} ${total === 1 ? 'avaliação' : 'avaliações'}`;

      if (container) {
        if (!data.comentarios || data.comentarios.length === 0) {
          container.innerHTML = `<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Nenhum comentário publicado ainda.</p>`;
        } else {
          container.innerHTML = data.comentarios.map(item => `
            <div class="comentario-card">
              <div class="comentario-header">
                <span class="comentario-cliente">👤 ${item.cliente_nome}</span>
                <span class="comentario-stars">${'⭐'.repeat(item.stars_tranca || 5)}</span>
              </div>
              <div class="comentario-servico">✨ ${item.servico}</div>
              <p class="comentario-texto">"${item.comentario}"</p>
            </div>
          `).join('');
        }
      }
    } else {
      if (container) container.innerHTML = `<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Nenhum comentário publicado ainda.</p>`;
    }
  } catch (err) {
    console.error("Erro ao carregar avaliações públicas:", err);
    if (container) container.innerHTML = `<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Nenhum comentário publicado ainda.</p>`;
  }
}

// Função auxiliar para resetar o select de horários
function limparHorarios() {
  const selectHorarios = document.getElementById('horario');
  if (selectHorarios) {
    selectHorarios.innerHTML = '<option value="">Selecione uma data primeiro</option>';
  }
}

// Preenche automaticamente Nome e Telefone do usuário se já cadastrados
async function carregarDadosUsuario() {
  try {
    const res = await fetch(`${API_URL}/api/usuario/${MEU_USER_ID}`);
    if (res.ok) {
      const data = await res.json();
      const inputNome = document.getElementById('nome');
      const inputTelefone = document.getElementById('telefone');

      if (data.cliente_nome && inputNome && !inputNome.value) {
        inputNome.value = data.cliente_nome;
      }

      if (data.cliente_telefone && inputTelefone && !inputTelefone.value) {
        let v = data.cliente_telefone.replace(/\D/g, '');
        if (v.length > 10) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (v.length > 6) {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
        }
        inputTelefone.value = v;
      }
    }
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err);
  }
}

// INICIALIZAÇÃO ÚNICA AO CARREGAR O DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
  resetarTemporizadorInatividade();
  carregarLogo();
  carregarBanners();
  carregarServicos();
  carregarAgendamentos();
  carregarAvaliacoesPublicas();
  carregarContato();
  carregarDadosUsuario();
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