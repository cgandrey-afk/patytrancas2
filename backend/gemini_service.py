import os
import json
import io
from google import genai
from PIL import Image

def analisar_imagem_com_gemini(bytes_imagem, observacao_cliente: str = ""):
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("Chave GEMINI_API_KEY não configurada.")
            
        client = genai.Client(api_key=api_key)
        
        imagem_pil = Image.open(io.BytesIO(bytes_imagem))
        if imagem_pil.mode in ("RGBA", "P"):
            imagem_pil = imagem_pil.convert("RGB")
            
        # Bloco de instrução condicional forte caso o cliente tenha digitado algo
        if observacao_cliente and observacao_cliente.strip():
            instrucao_cliente = f"""
            PEDIDO DO CLIENTE: "{observacao_cliente}"
            
            SIGA ESTE PASSO A PASSO OBRIGATÓRIO PARA O CÁLCULO:
            1. PASSO 1: Analise a imagem original e determine o tempo base que o penteado levaria completo (incluindo o que a foto mostra).
            2. PASSO 2: Leia a observação do cliente e veja o que deve ser retirado ou adicionado (ex: remover acessórios, fitas ou anéis economiza em média 15 a 20 minutos).
            3. PASSO 3: Faça a conta matemática exata (Tempo Base da Foto + Adição ou - Subtração) para definir o "tempo_estimado_minutos" final.
            4. No campo "observacao", comece citando o pedido do cliente e explique claramente a conta feita (ex: "Considerando o tempo base da foto de 90 minutos, com a remoção dos acessórios subtraímos 20 minutos, totalizando 70 minutos...").
            """
        else:
            instrucao_cliente = "Analise a imagem normalmente considerando o que é visto e defina o tempo estimado."

        prompt = f"""
        Você é uma trancista profissional e especialista em penteados afro e nagô.
        {instrucao_cliente}
        
        Retorne ESTRITAMENTE um objeto JSON válido (sem blocos de código markdown ou crases, apenas o JSON puro):
        {{
          "estilo_identificado": "Nome do estilo",
          "dificuldade": "Baixa, Média ou Alta",
          "tempo_estimado_minutos": 70,
          "observacao": "Siga rigorosamente a instrução do Passo 4 explicando o cálculo de tempo."
        }}
        """

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[prompt, imagem_pil]
        )

        texto_resultado = response.text.strip()
        if texto_resultado.startswith("```"):
            lines = texto_resultado.splitlines()[1:-1]
            texto_resultado = "\n".join(lines).strip()

        return json.loads(texto_resultado)
    except Exception as e:
        print(f"Erro Gemini: {e}")
        return None

def gerar_descricao_com_gemini(nome: str, categoria: str = "", tempo: str = "", durabilidade: str = ""):
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("Chave GEMINI_API_KEY não configurada.")

        client = genai.Client(api_key=api_key)

        prompt = f"""
        Você é uma especialista em tranças e penteados afros da marca 'Paty Trancas'.
        Crie descrições profissionais, atraentes e 100% EXCLUSIVAS para o modelo de trança: "{nome}" (categoria: "{categoria}", tempo de execução: "{tempo}", durabilidade: "{durabilidade}").

        Retorne ESTRITAMENTE um objeto JSON válido (sem blocos de código markdown ou crases, apenas o JSON puro):
        {{
          "descricao_curta": "uma frase curta, elegante e chamativa sobre este estilo específico (máximo 120 caracteres)",
          "descricao_longa": "uma descrição detalhada e encantadora sobre o charme deste modelo, sua versatilidade, praticidade e dicas de cuidados com touca de cetim"
        }}
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        texto_resultado = response.text.strip()
        if texto_resultado.startswith("```"):
            lines = texto_resultado.splitlines()[1:-1]
            texto_resultado = "\n".join(lines).strip()

        return json.loads(texto_resultado)
    except Exception as e:
        print(f"Erro ao gerar descrição com Gemini: {e}")
        return None