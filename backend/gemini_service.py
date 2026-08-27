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
        Analise a imagem enviada e estime a complexidade e o TEMPO REAL.
        
        OBSERVAÇÃO OU PEDIDO ESPECIAL DO CLIENTE: "{observacao_cliente}"
        INSTRUÇÃO CRUCIAL: No campo "observacao" do JSON, você DEVE obrigatoriamente começar mencionando o pedido do cliente (por exemplo: "Atendendo ao seu pedido de fazer sem acessórios..." ou "Considerando sua observação: [repetir o pedido]..."), explicando como isso impactou na execução ou no tempo estimado do penteado.
        
        Retorne ESTRITAMENTE um objeto JSON (sem marcações markdown):
        {{
          "estilo_identificado": "Nome do estilo",
          "dificuldade": "Baixa, Média ou Alta",
          "tempo_estimado_minutos": 120,
          "observacao": "Comece obrigatoriamente citando o pedido do cliente e detalhe o porquê da estimativa e da complexidade."
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