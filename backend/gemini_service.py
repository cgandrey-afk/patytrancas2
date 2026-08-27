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
            
        # Contexto extra se o cliente digitou algo
        nota_cliente_contexto = f"\nOBSERVAÇÃO DO CLIENTE SOBRE O PEDIDO: \"{observacao_cliente}\"\nLeve essa observação em conta para ajustar o tempo estimado e a descrição caso mude a complexidade (ex: menos tranças reduzem o tempo, acessórios podem alterar o processo)." if observacao_cliente else ""

        prompt = f"""
        Você é uma trancista profissional e especialista em penteados afro e nagô.
        Analise a imagem enviada e estime a complexidade e o TEMPO REAL.{nota_cliente_contexto}
        
        Retorne ESTRITAMENTE um objeto JSON (sem marcações markdown):
        {{
          "estilo_identificado": "Nagô Topo com Desenho Geométrico",
          "Complexidade ": "Alta",
          "tempo_estimado_minutos": 180,
          "observacao": "Explicação detalhada da complexidade do desenho e como a observação do cliente afeta o resultado."
        }}
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",  # Ou o modelo que estiver usando/testando
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