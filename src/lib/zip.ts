/**
 * ESCRITOR DE ZIP, em modo STORE (sem compressão).
 *
 * Existe por causa de um caminho fechado: baixar as capturas por `fetch`
 * no cliente e empacotar no navegador exigiria configurar CORS no bucket
 * — os objetos são públicos, mas sem cabeçalho de CORS o `fetch` de outra
 * origem é bloqueado (é o mesmo motivo pelo qual o download de UMA imagem
 * é feito com `Content-Disposition: attachment`, e não por fetch). Então
 * quem empacota é o servidor, que busca do Storage sem esbarrar nisso.
 *
 * **STORE, e não DEFLATE**, porque o conteúdo é PNG e JPEG: já vêm
 * comprimidos, e passá-los pelo `deflate` gastaria CPU por uns poucos
 * porcento — às vezes crescendo o arquivo.
 *
 * **Gerador, e não um `Uint8Array` de uma vez**: seis capturas de celular
 * passam com folga dos poucos MB que uma resposta não-transmitida
 * comporta numa função serverless. Emitindo pedaço por pedaço, o tamanho
 * do pacote deixa de ser um teto.
 *
 * Sem dependência nova: o formato de um ZIP sem compressão é três blocos
 * de campos em little-endian, e escrevê-los é menos código do que a
 * checagem de licença de uma biblioteca.
 */

export interface ArquivoZip {
  /** Caminho dentro do pacote (aceita `/` para pastas). */
  nome: string;
  dados: Uint8Array;
}

const ASSINATURA_LOCAL = 0x04034b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_FIM = 0x06054b50;
/** Nome em UTF-8 (bit 11). Sem isso, acento no nome do arquivo vira lixo. */
const FLAG_UTF8 = 0x0800;
const METODO_STORE = 0;
/** Versão mínima que lê STORE — 2.0, o piso universal. */
const VERSAO = 20;

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

/** CRC-32 (o mesmo do PNG e do ZIP). */
export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i += 1) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Data/hora no formato DOS que o ZIP usa. **Fixa em 1980-01-01**, de
 * propósito: um pacote gerado duas vezes com o mesmo conteúdo sai byte a
 * byte igual, o que torna o formato testável. A data de um arquivo dentro
 * do pacote não informa nada a ninguém aqui — quem quer saber quando a
 * captura foi feita olha o horário de geração na ficha.
 */
const DATA_DOS = 0x0021;
const HORA_DOS = 0x0000;

function bytesDoNome(nome: string): Uint8Array {
  return new TextEncoder().encode(nome);
}

function cabecalhoLocal(arquivo: ArquivoZip, crc: number, nome: Uint8Array): Uint8Array {
  const buf = new Uint8Array(30 + nome.length);
  const v = new DataView(buf.buffer);
  v.setUint32(0, ASSINATURA_LOCAL, true);
  v.setUint16(4, VERSAO, true);
  v.setUint16(6, FLAG_UTF8, true);
  v.setUint16(8, METODO_STORE, true);
  v.setUint16(10, HORA_DOS, true);
  v.setUint16(12, DATA_DOS, true);
  v.setUint32(14, crc, true);
  v.setUint32(18, arquivo.dados.length, true);
  v.setUint32(22, arquivo.dados.length, true);
  v.setUint16(26, nome.length, true);
  v.setUint16(28, 0, true);
  buf.set(nome, 30);
  return buf;
}

function entradaCentral(
  arquivo: ArquivoZip,
  crc: number,
  nome: Uint8Array,
  deslocamento: number,
): Uint8Array {
  const buf = new Uint8Array(46 + nome.length);
  const v = new DataView(buf.buffer);
  v.setUint32(0, ASSINATURA_CENTRAL, true);
  v.setUint16(4, VERSAO, true);
  v.setUint16(6, VERSAO, true);
  v.setUint16(8, FLAG_UTF8, true);
  v.setUint16(10, METODO_STORE, true);
  v.setUint16(12, HORA_DOS, true);
  v.setUint16(14, DATA_DOS, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, arquivo.dados.length, true);
  v.setUint32(24, arquivo.dados.length, true);
  v.setUint16(28, nome.length, true);
  v.setUint32(42, deslocamento, true);
  buf.set(nome, 46);
  return buf;
}

function fimDoDiretorio(entradas: number, tamanho: number, deslocamento: number): Uint8Array {
  const buf = new Uint8Array(22);
  const v = new DataView(buf.buffer);
  v.setUint32(0, ASSINATURA_FIM, true);
  v.setUint16(8, entradas, true);
  v.setUint16(10, entradas, true);
  v.setUint32(12, tamanho, true);
  v.setUint32(16, deslocamento, true);
  return buf;
}

/**
 * Emite o pacote em pedaços, um arquivo de cada vez — só o arquivo
 * corrente fica na memória, nunca o pacote inteiro.
 *
 * A entrada é assíncrona porque quem chama busca cada imagem do Storage na
 * hora: assim o primeiro byte sai antes de a última imagem ter chegado.
 */
export async function* fluxoZip(
  arquivos: AsyncIterable<ArquivoZip> | Iterable<ArquivoZip>,
): AsyncGenerator<Uint8Array> {
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  let entradas = 0;

  for await (const arquivo of arquivos) {
    const nome = bytesDoNome(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const cabecalho = cabecalhoLocal(arquivo, crc, nome);

    yield cabecalho;
    yield arquivo.dados;

    central.push(entradaCentral(arquivo, crc, nome, deslocamento));
    deslocamento += cabecalho.length + arquivo.dados.length;
    entradas += 1;
  }

  const inicioCentral = deslocamento;
  let tamanhoCentral = 0;
  for (const entrada of central) {
    yield entrada;
    tamanhoCentral += entrada.length;
  }
  yield fimDoDiretorio(entradas, tamanhoCentral, inicioCentral);
}
