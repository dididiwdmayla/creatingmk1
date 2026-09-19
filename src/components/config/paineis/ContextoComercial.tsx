"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { CAMPO_BASE_CLS, mensagemErroFila } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_CONTEXTO_COMERCIAL = "contexto-comercial";

/**
 * "Contexto comercial" — o que a IA sabe sobre o que o operador VENDE (ver
 * "Contexto comercial" no ARCHITECTURE.md). Painel AUTÔNOMO (busca e salva
 * pela própria rota, `/api/config/contexto-comercial`), mesmo padrão de
 * "Frases": GET aberto a qualquer sessão, PUT restrito ao admin, e o campo
 * salva sozinho no blur — sem "Salvar" geral.
 *
 * UM campo de TEXTO LIVRE, de propósito: as perguntas de um lead não são
 * previsíveis, e o operador precisa acrescentar linha nova a cada pergunta
 * nova sem esperar deploy. Nada de formulário com campos fixos de preço/
 * prazo/escopo aqui.
 */
export function ContextoComercialSection() {
  const [texto, setTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [restrito, setRestrito] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .getContextoComercial()
      .then(({ contexto }) => {
        if (!ignore) setTexto(contexto.texto);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(mensagemErroFila(error, "Falha ao carregar o contexto comercial"));
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvar(valor: string) {
    setSalvando(true);
    setErro(null);
    try {
      const { contexto } = await api.putContextoComercial({ texto: valor });
      setTexto(contexto.texto);
      setRestrito(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setRestrito(true);
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setSalvando(false);
    }
  }

  const resumo =
    texto === null ? undefined : texto.trim() ? `${texto.trim().length} caracteres` : "vazio";

  return (
    <PainelColapsavel id={PAINEL_CONTEXTO_COMERCIAL} titulo="Contexto comercial" resumo={resumo}>
      <p className="mt-1 text-xs text-ink-muted">
        Texto livre sobre o que ESTE negócio vende: o que existe, como funciona, preços e prazos
        que você quer que a IA use ao rascunhar respostas para os leads. Vai junto do contexto do
        lead no prompt do rascunho de resposta (ver &ldquo;Fila de respostas&rdquo;).
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Duas regras duras, sempre: a IA nunca inventa um número (preço, prazo, desconto) que não
        esteja escrito aqui — sem a informação, o rascunho marca{" "}
        <code className="font-mono">[PREENCHER: ...]</code> em vez de chutar. E nunca promete
        prazo, escopo ou condição que este texto não declarar.
      </p>

      {texto === null && !erro && (
        <SkeletonRows count={1} className="mt-3 h-40 rounded border border-line" />
      )}

      {texto !== null && (
        <TextoContextoComercial valor={texto} disabled={salvando} onSalvar={salvar} />
      )}

      {restrito && (
        <p className="mt-2 text-xs text-critical">
          Editar o contexto comercial é restrito ao admin — o texto acima não foi salvo.
        </p>
      )}
      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/** A caixa de texto livre: salva no blur, cresce com o conteúdo (sem teto: é o único lugar onde este texto existe). */
function TextoContextoComercial({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string;
  disabled: boolean;
  onSalvar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  // Ressincroniza quando o valor vem de fora (salvo com sucesso, ou outra
  // aba) — ajuste de estado durante a renderização, mesmo padrão de
  // `FilaNumeroTesteInput`/`LimiteInput` em comum.tsx.
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor);
  }

  function commit() {
    if (texto !== valor) onSalvar(texto);
  }

  return (
    <textarea
      value={texto}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      disabled={disabled}
      rows={10}
      placeholder={
        'Ex.: "Fazemos site institucional a partir de R$1.500, prazo de 10 dias úteis. ' +
        'Inclui 1 ano de hospedagem. Não fazemos loja virtual (e-commerce)."'
      }
      className={`${CAMPO_BASE_CLS} mt-3 resize-y text-sm leading-relaxed disabled:opacity-50`}
    />
  );
}
