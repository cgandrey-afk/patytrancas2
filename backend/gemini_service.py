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
            ATENÇÃO OBRIGATÓRIA À OBSERVAÇÃO DO CLIENTE: "{observacao_cliente}"
            - Você DEVE adaptar obrigatoriamente a sua análise baseada neste pedido. 
            - Se o cliente pediu para remover algo (ex: "sem acessórios", "menos tranças"), você NÃO deve considerar esses elementos, deve recalcular/reduzir o tempo estimado em relação ao que aparece visualmente na foto, e o campo "observacao" DEVE obrigatoriamente iniciar explicando como este pedido alterou a execução do penteado.
            """
        else:
            instrucao_cliente = "Analise a imagem normalmente considerando o que é visto."

        prompt = f"""
        Você é uma trancista profissional e especialista em penteados afro e nagô.
        {instrucao_cliente}
        
        Retorne ESTRITAMENTE um objeto JSON válido (sem blocos de código markdown ou crases extras, apenas o JSON puro):
        {{
          "estilo_identificado": "Nome do estilo ajustado ao pedido",
          "dificuldade": "Baixa, Média ou Alta",
          "tempo_estimado_minutos": 120,
          "observacao": "Inicie obrigatoriamente mencionando o pedido do cliente e detalhe o impacto na execução e no tempo."
        }}
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
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