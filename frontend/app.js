const API_URL = "https://patytrancas2.onrender.com";

async function analisarFoto() {
  const fileInput = document.getElementById('fotoInput');
  const divResultado = document.getElementById('resultadoIA');
  
  if (!fileInput.files[0]) {
    alert("Selecione uma imagem primeiro!");
    return;
  }

  divResultado.innerHTML = "Analisando imagem com IA...";
  const formData = new FormData();
  formData.append("foto", fileInput.files[0]);

  try {
    const res = await fetch(`${API_URL}/api/analisar-ia`, { method: "POST", body: formData });
    const data = await res.json();
    
    if (res.ok) {
      divResultado.innerHTML = `
        <strong>Estilo:</strong> ${data.estilo_identificado}<br>
        <strong>Dificuldade:</strong> ${data.dificuldade}<br>
        <strong>Tempo Estimado:</strong> ${data.tempo_estimado_minutos} min<br>
        <strong>Obs:</strong> ${data.observacao}
      `;
    } else {
      divResultado.innerHTML = "Erro ao analisar imagem.";
    }
  } catch (err) {
    divResultado.innerHTML = "Erro de conexão com a API.";
  }
}

async function agendar(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('mensagemStatus');
  
  const payload = {
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
      statusDiv.innerHTML = "<p style='color:green;'>Agendamento realizado com sucesso!</p>";
      document.getElementById('formAgendamento').reset();
    } else {
      statusDiv.innerHTML = "<p style='color:red;'>Erro ao realizar agendamento.</p>";
    }
  } catch (err) {
    statusDiv.innerHTML = "<p style='color:red;'>Erro na requisição.</p>";
  }
}