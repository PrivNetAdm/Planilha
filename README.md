# Planilha / Dashboard de Lucro Presumido 2026

Aplicativo HTML estático para cálculo de Lucro Presumido de empresas de comércio em 2026, considerando a LC 224/2025 e o recálculo anual do excedente trimestral.

## Como usar

1. Abra `index.html` no navegador.
2. Preencha os valores mensais de cada trimestre.
3. Clique em **Calcular tudo** para revisar os quadros.
4. Use **Gerar XML** para baixar a estrutura de exportação.
5. Use **Gerar PDF** para abrir a impressão do navegador e salvar em PDF.

## Cobertura atual

- Comércio apenas.
- IRPJ com base presumida de 8% e 8,8% no excedente.
- CSLL com base presumida de 12% e 13,2% a partir do 2º trimestre de 2026.
- Receita sujeita ao limite separada das receitas financeiras, conforme o Perguntas e Respostas da Receita.
- Receitas financeiras somadas integralmente ao IRPJ/CSLL.
- IRRF mensal acumulado por trimestre.
- PIS/COFINS cumulativos com exclusão de ICMS informado e receita monofásica informada.
- Recálculo anual com crédito para o 4º trimestre.
- Diagnóstico anual e quadros explicativos com regras derivadas do Perguntas e Respostas da Receita Federal.
