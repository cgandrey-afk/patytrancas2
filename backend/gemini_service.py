import os
import json
import io
from google import genai
from PIL import Image

def analisar_imagem_com_gemini(bytes_imagem):
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("Chave GEMINI_API_KEY não configurada.")
            
        client = genai.Client(api_key=api_key)
        
        imagem_pil = Image.open(io.BytesIO(bytes_imagem))
        if imagem_pil.mode in ("RGBA", "P"):
            imagem_pil = imagem_pil.convert("RGB")
            
        prompt = """
        Você é uma trancista profissional e especialista em penteados afro e nagô.
        Analise a imagem enviada e estime a complexidade e o TEMPO REAL.
        
        Retorne ESTRITAMENTE um objeto JSON (sem marcações markdown):
        {
          "estilo_identificado": "Nagô Topo com Desenho Geométrico",
          "dificuldade": "Alta",
          "tempo_estimado_minutos": 180,
          "observacao": "Explicação detalhada da complexidade do desenho."
        }
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