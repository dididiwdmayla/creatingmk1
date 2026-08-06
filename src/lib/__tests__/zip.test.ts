import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crc32, fluxoZip, type ArquivoZip } from "../zip";

/**
 * O pacote das capturas. O teste que importa é o último: um ZIP escrito à
 * mão só serve se um descompactador de verdade o abrir — o resto é
 * conferência de campo, que sozinha passaria feliz num arquivo que
 * ninguém consegue abrir.
 */

async function empacotar(arquivos: ArquivoZip[]): Promise<Uint8Array> {
  const pedacos: Uint8Array[] = [];
  for await (const pedaco of fluxoZip(arquivos)) pedacos.push(pedaco);
  const total = pedacos.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of pedacos) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

const bytes = (texto: string) => new TextEncoder().encode(texto);

describe("crc32", () => {
  it("bate com os valores canônicos", () => {
    expect(crc32(bytes(""))).toBe(0);
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
  });
});

describe("fluxoZip", () => {
  it("abre e fecha com as assinaturas do formato", async () => {
    const zip = await empacotar([{ nome: "a.txt", dados: bytes("oi") }]);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    // Duas entradas contadas no fim: uma no diretório, uma no total.
    expect(v.getUint16(zip.length - 22 + 8, true)).toBe(1);
    expect(v.getUint16(zip.length - 22 + 10, true)).toBe(1);
  });

  it("pacote vazio ainda é um ZIP válido (só o fim do diretório)", async () => {
    const zip = await empacotar([]);
    expect(zip.length).toBe(22);
  });

  it("sai byte a byte igual para o mesmo conteúdo — a data é fixa de propósito", async () => {
    const um = await empacotar([{ nome: "a.png", dados: bytes("dados") }]);
    const outro = await empacotar([{ nome: "a.png", dados: bytes("dados") }]);
    expect(Buffer.from(um).equals(Buffer.from(outro))).toBe(true);
  });

  it("aceita entrada assíncrona: a imagem seguinte é buscada enquanto a anterior já saiu", async () => {
    async function* daRede(): AsyncGenerator<ArquivoZip> {
      yield { nome: "1.png", dados: bytes("um") };
      await new Promise((r) => setTimeout(r, 1));
      yield { nome: "2.png", dados: bytes("dois") };
    }
    const pedacos: Uint8Array[] = [];
    for await (const p of fluxoZip(daRede())) pedacos.push(p);
    // Cabeçalho + dados por arquivo, mais duas entradas centrais e o fim.
    expect(pedacos.length).toBe(2 * 2 + 2 + 1);
  });

  it("um descompactador de verdade abre o pacote e devolve o conteúdo", async () => {
    const zip = await empacotar([
      { nome: "celular/01-hero.png", dados: bytes("conteúdo do hero") },
      { nome: "desktop/01-hero.png", dados: bytes("outro") },
      // Acento no nome é o caso que a flag de UTF-8 existe pra cobrir.
      { nome: "prévia.jpg", dados: bytes("cartão") },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-teste-"));
    const caminho = join(dir, "capturas.zip");
    writeFileSync(caminho, zip);

    const listagem = spawnSync("unzip", ["-l", caminho], { encoding: "utf8" });
    if (listagem.error) return; // ambiente sem `unzip`: os outros testes cobrem os campos
    expect(listagem.status).toBe(0);
    expect(listagem.stdout).toContain("celular/01-hero.png");
    expect(listagem.stdout).toContain("prévia.jpg");

    const extraido = spawnSync("unzip", ["-p", caminho, "desktop/01-hero.png"], {
      encoding: "utf8",
    });
    expect(extraido.stdout).toBe("outro");
  });
});
