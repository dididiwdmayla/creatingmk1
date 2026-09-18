"use client";

import { useEffect, useState } from "react";

import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { INPUT_CLS } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";
import type { Papel, UsuarioPublico } from "@/lib/usuarios/types";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
const PAINEL_USUARIOS = "usuarios";

/**
 * Gestão de usuários (admin): criar, renomear, ativar/desativar, trocar
 * papel e redefinir senha. O proxy já manda membros de volta ao painel;
 * este componente é a UI sobre /api/usuarios.
 */
export function UsuariosSection() {
  const [usuarios, setUsuarios] = useState<UsuarioPublico[] | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaDe, setSenhaDe] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState("");
  // Exclusão (além de desativar): confirmação DUPLA — 2 modais em sequência,
  // cada um exigindo um clique deliberado antes da chamada real à API.
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string; etapa: 1 | 2 } | null>(
    null,
  );

  useEffect(() => {
    let ignore = false;
    Promise.all([api.listUsuarios(), api.me()])
      .then(([{ usuarios: lista }, { usuario }]) => {
        if (ignore) return;
        setUsuarios(lista);
        setMeuId(usuario.id);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Gestão de usuários é restrita ao admin."
            : "Falha ao carregar os usuários.",
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  function aplicar(id: string, patch: { papel?: Papel; ativo?: boolean; senha?: string }) {
    setOcupado(id);
    setErro(null);
    setAviso(null);
    api
      .patchUsuario(id, patch)
      .then(({ usuario }) => {
        setUsuarios((atual) =>
          (atual ?? []).map((u) => (u.id === usuario.id ? usuario : u)),
        );
        if (patch.senha !== undefined) {
          setAviso(`Senha de "${usuario.nome}" redefinida.`);
          setSenhaDe(null);
          setSenhaNova("");
        }
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao salvar o usuário."),
      )
      .finally(() => setOcupado(null));
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    if (excluindo.etapa === 1) {
      setExcluindo({ ...excluindo, etapa: 2 });
      return;
    }
    const { id, nome } = excluindo;
    setOcupado(id);
    setErro(null);
    setAviso(null);
    api
      .excluirUsuario(id)
      .then(() => {
        setUsuarios((atual) => (atual ?? []).filter((u) => u.id !== id));
        setAviso(`Usuário "${nome}" excluído — leads/contatos/mensagens dele permanecem, marcados "usuário removido".`);
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao excluir o usuário."),
      )
      .finally(() => {
        setOcupado(null);
        setExcluindo(null);
      });
  }

  function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOcupado("novo");
    setErro(null);
    setAviso(null);
    api
      .createUsuario({ nome: novoNome, ...(novaSenha && { senha: novaSenha }) })
      .then(({ usuario }) => {
        setUsuarios((atual) => [...(atual ?? []), usuario]);
        setNovoNome("");
        setNovaSenha("");
        setAviso(`Usuário "${usuario.nome}" criado.`);
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao criar o usuário."),
      )
      .finally(() => setOcupado(null));
  }

  /**
   * Quantos são e quantos ainda não conseguem entrar — as duas coisas que
   * o admin viria checar aqui. Sai da lista que a seção já carregou.
   */
  const semSenha = (usuarios ?? []).filter((u) => !u.temSenha).length;
  const resumo =
    usuarios === null
      ? undefined
      : `${usuarios.length}${semSenha > 0 ? ` · ${semSenha} sem senha` : ""}`;

  if (erro && usuarios === null) {
    return (
      <PainelColapsavel id={PAINEL_USUARIOS} titulo="Usuários" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </PainelColapsavel>
    );
  }

  // A lista ainda não chegou: o mesmo invólucro da seção, com skeletons no
  // lugar das linhas — nunca uma seção vazia que cresce quando os dados
  // chegam (é isso que empurra o resto da página).
  if (usuarios === null) {
    return (
      <PainelColapsavel id={PAINEL_USUARIOS} titulo="Usuários" resumo={resumo}>
        <p className="mt-1 text-xs text-ink-muted">
          Membro sem senha definida não consegue entrar — defina uma aqui. Desativar/redefinir
          derruba as sessões do usuário.
        </p>
        <div className="mt-3">
          <SkeletonRows count={2} className="h-14 rounded border border-line" />
        </div>
      </PainelColapsavel>
    );
  }

  return (
    <PainelColapsavel id={PAINEL_USUARIOS} titulo="Usuários" resumo={resumo}>
      <p className="mt-1 text-xs text-ink-muted">
        Membro sem senha definida não consegue entrar — defina uma aqui. Desativar/redefinir
        derruba as sessões do usuário.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {(usuarios ?? []).map((u) => (
          <div key={u.id} className="rounded border border-line p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${u.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {u.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {u.papel}
              </span>
              {!u.temSenha && (
                <span className="text-[11px] text-warning">sem senha definida</span>
              )}
              {u.id === meuId && <span className="text-[11px] text-ink-muted">(você)</span>}
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={ocupado === u.id}
                  onClick={() => setSenhaDe(senhaDe === u.id ? null : u.id)}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Redefinir senha
                </button>
                <button
                  type="button"
                  disabled={ocupado === u.id}
                  onClick={() => aplicar(u.id, { ativo: !u.ativo })}
                  className="text-xs text-ink-muted hover:text-foreground disabled:opacity-50"
                >
                  {u.ativo ? "Desativar" : "Reativar"}
                </button>
                <button
                  type="button"
                  disabled={ocupado === u.id || u.id === meuId}
                  title={u.id === meuId ? "Não dá pra excluir o próprio usuário" : undefined}
                  onClick={() => setExcluindo({ id: u.id, nome: u.nome, etapa: 1 })}
                  className="text-xs text-critical hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir
                </button>
              </span>
            </div>
            {senhaDe === u.id && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nova senha (mín. 4)"
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  disabled={senhaNova.length < 4 || ocupado === u.id}
                  onClick={() => aplicar(u.id, { senha: senhaNova })}
                  className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
                >
                  Definir
                </button>
              </div>
            )}
          </div>
        ))}
        {usuarios === null && <p className="text-sm text-ink-muted">Carregando usuários…</p>}
      </div>

      <form onSubmit={criar} className="mt-3 flex items-center gap-2">
        <input
          placeholder="Novo usuário"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className={INPUT_CLS}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Senha (opcional)"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className={INPUT_CLS}
        />
        <button
          type="submit"
          disabled={novoNome.trim().length < 2 || ocupado === "novo"}
          className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
      {aviso && <p className="mt-2 text-sm text-good">{aviso}</p>}

      <ConfirmModal
        aberto={excluindo?.etapa === 1}
        titulo={`Excluir "${excluindo?.nome}"?`}
        mensagem='Os leads/contatos/mensagens registrados por este usuário permanecem na base (marcados "usuário removido"); só os contadores de cota individual dele são apagados. Esta ação não pode ser desfeita.'
        confirmarLabel="Continuar"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
      <ConfirmModal
        aberto={excluindo?.etapa === 2}
        titulo="Confirmação final"
        mensagem={`Confirma DEFINITIVAMENTE a exclusão de "${excluindo?.nome}"?`}
        confirmarLabel="Excluir para sempre"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </PainelColapsavel>
  );
}
